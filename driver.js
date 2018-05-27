var FSIZE = (new Float32Array()).BYTES_PER_ELEMENT; // size of a vertex coordinate (32-bit float)
// Vertex shader program

var VSHADER_SOURCE = null;
var FSHADER_SOURCE = null; // fragment shader program

var vertices = [];
var colors = [];
var normals = [];
var indices = [];

var ambientCount = 0;
var specCount = 0;
var lightPosX = 3.3;

var viewType = 0;
var nearPlane = 0;
var cameraToggle = 0;
var cameraX = 6;
var cameraY = 6;

var clickType;
var shouldMove = 0;
var lastX;
var lastY;

var ANGLE_STEP = 45.0
var currentAngle = 0.0;

function main() {
  // Retrieve <canvas> element
  var canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  loadFile("shader.vert", function(shader_src) {
      setShader(gl, canvas, gl.VERTEX_SHADER, shader_src); 
  });
  
  loadFile("shader.frag", function(shader_src) {
      setShader(gl, canvas, gl.FRAGMENT_SHADER, shader_src); 
  });

  var mbutton = document.getElementById("moveC");
  mbutton.onclick = function(ev){ moveCube(ev, gl, canvas); };

  var lbutton = document.getElementById("moveL");
  lbutton.onclick = function(ev){ moveLight(ev, gl, canvas); };

  var abutton = document.getElementById("changeAmbient");
  abutton.onclick = function(ev){ changeAmbient(ev, gl, canvas); };

  var sbutton = document.getElementById("changeSpecular");
  sbutton.onclick = function(ev){ changeSpecular(ev, gl, canvas); };

  var rbutton = document.getElementById("rotateY");
  rbutton.onclick = function(ev){ rotateIndefinite(ev, gl, canvas); };

  var gravbutton = document.getElementById("gravity");
  gravbutton.onclick = function(ev){ applyGravity(ev, gl, canvas); };

  var shearButton = document.getElementById("shear");
  shearButton.onclick = function(ev){ shearTransform(ev, gl, canvas); };

  var gSlider = document.getElementById("glossiness");
  gSlider.oninput = function(ev){ setGloss(ev, gl, canvas, gSlider); }

  var pSlider = document.getElementById("nearPlane");
  pSlider.oninput = function(ev){ setPlane(ev, gl, canvas, pSlider); }    
}

// set appropriate shader and start if both are loaded
function setShader(gl, canvas, shader, shader_src) {
  if (shader == gl.VERTEX_SHADER)
    VSHADER_SOURCE = shader_src;
  if (shader == gl.FRAGMENT_SHADER)
    FSHADER_SOURCE = shader_src;
  
  if (VSHADER_SOURCE && FSHADER_SOURCE)
    start(gl, canvas);
}

var transModelMatrix = null;
var rotModelMatrix = null;
var scaleModelMatrix = null;
var clickPixels = new Uint8Array(4);

// called by 'setShader' when shaders are done loading
function start(gl, canvas) {
  // initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // specify the color for clearing <canvas>
  gl.clearColor(0, 0, 0, 1);
  // clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Register function event handlers
  canvas.onmousedown = function(ev){ dragFlag(canvas, ev, gl, 0); };
  canvas.onmousemove = function(ev){ dragFlag(canvas, ev, gl, 1); };
  canvas.onmouseup = function(ev){ changeMovement(canvas, ev, gl, 1); };
  window.onkeypress = function(ev){ keypress(canvas, ev, gl); };
  window.onkeydown = function(ev){ keydown(canvas, ev, gl); };
  document.getElementById('update_screen').onclick = function(){ updateScreen(canvas, gl); };
  document.getElementById('save_canvas').onclick = function(){ saveCanvas(); };
  // setup SOR object reading/writing
  setupIOSOR("fileinput"); 

  // Set the vertex coordinates, the color and the normal
  n = initVertexBuffers(gl);
  if (n < 0) {
    console.log('Failed to set the vertex information');
    return;
  }

  // Set the clear color and enable the depth test
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);

  // Get the storage locations of uniform variables and so on
  var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  var u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');

  var u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  var u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');

  var u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
  var u_LightPosition = gl.getUniformLocation(gl.program, 'u_LightPosition');
  var u_AmbientLight = gl.getUniformLocation(gl.program, 'u_AmbientLight');
  var u_SpecularLight = gl.getUniformLocation(gl.program, 'u_SpecularLight');
  var u_shade_toggle = gl.getUniformLocation(gl.program, 'u_shade_toggle');
  var u_shine = gl.getUniformLocation(gl.program, 'u_shine');
  var u_Picked = gl.getUniformLocation(gl.program, 'u_Picked');
  var u_Perspective = gl.getUniformLocation(gl.program, 'u_Perspective');
  
  if (!u_NormalMatrix || !u_ProjectionMatrix || !u_ViewMatrix || !u_LightColor || !u_LightPosition|| !u_AmbientLight || !u_SpecularLight || !u_shade_toggle || !u_Picked || !u_Perspective) { 
    console.log('Failed to get the storage location');
    return;
  }

  // Set the light color (white)
  gl.uniform3f(u_LightColor, 1.0, 1.0, 1.0);
  // Set the light direction (in the world coordinate)
  gl.uniform3f(u_LightPosition, 3.3, 4.0, 3.5);
  // Set the ambient light
  gl.uniform3f(u_AmbientLight, 0.0, 0.0, 0.2);
  // Set specular light
  gl.uniform3f(u_SpecularLight, 0.0, 1.0, 0.0);
  //Set shading type, Gouraud initially
  gl.uniform1i(u_shade_toggle, 0);
  //Set shininess
  gl.uniform1f(u_shine, 25.0);
  // Init selected object
  gl.uniform1i(u_Picked, 0);
  // Initially perspective view
  gl.uniform1i(u_Perspective, 0);

  transModelMatrix = new Matrix4();  // Model matrix
  rotModelMatrix = new Matrix4();
  scaleModelMatrix = new Matrix4();
  
  var normalMatrix = new Matrix4(); // Transformation matrix for normals
  var viewMatrix = new Matrix4();
  var projectionMatrix = new Matrix4();

  nearPlane = 1;

  // Pass the model matrix to u_ModelMatrix
  gl.uniformMatrix4fv(u_ModelMatrix, false, transModelMatrix.elements);

  // Calculate projection and view matrices
  viewMatrix.setLookAt(6, 6, 10, 0, 0, 0, 0, 1, 0);
  projectionMatrix.setPerspective(60, canvas.width/canvas.height, nearPlane, 100);
  
  gl.uniformMatrix4fv(u_ViewMatrix, false, viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, projectionMatrix.elements);

  // Pass the matrix to transform the normal based on the model matrix to u_NormalMatrix
  normalMatrix.setInverseOf(transModelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);

  // Clear color and depth buffer
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Draw the cube
  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_BYTE, 0);
}

function initVertexBuffers(gl) {
  // Create a cube
  //    v6----- v5
  //   /|      /|
  //  v1------v0|
  //  | |     | |
  //  | |v7---|-|v4
  //  |/      |/
  //  v2------v3
  // Coordinates
  vertices = new Float32Array([
    2.0, 2.0, 2.0,  -2.0, 2.0, 2.0,  -2.0,-2.0, 2.0,   2.0,-2.0, 2.0, // v0-v1-v2-v3 front
    2.0, 2.0, 2.0,   2.0,-2.0, 2.0,   2.0,-2.0,-2.0,   2.0, 2.0,-2.0, // v0-v3-v4-v5 right
    2.0, 2.0, 2.0,   2.0, 2.0,-2.0,  -2.0, 2.0,-2.0,  -2.0, 2.0, 2.0, // v0-v5-v6-v1 up
    -2.0, 2.0, 2.0,  -2.0, 2.0,-2.0,  -2.0,-2.0,-2.0,  -2.0,-2.0, 2.0, // v1-v6-v7-v2 left
    -2.0,-2.0,-2.0,   2.0,-2.0,-2.0,   2.0,-2.0, 2.0,  -2.0,-2.0, 2.0, // v7-v4-v3-v2 down
    2.0,-2.0,-2.0,  -2.0,-2.0,-2.0,  -2.0, 2.0,-2.0,   2.0, 2.0,-2.0  // v4-v7-v6-v5 back
  ]);

  // Colors
  colors = new Float32Array([
    1, 0.2, 0.2,   1, 0.2, 0.2,   1, 0.2, 0.2,  1, 0.2, 0.2,     // v0-v1-v2-v3 front
    1, 0.2, 0.2,   1, 0.2, 0.2,   1, 0.2, 0.2,  1, 0.2, 0.2,     // v0-v3-v4-v5 right
    1, 0.2, 0.2,   1, 0.2, 0.2,   1, 0.2, 0.2,  1, 0.2, 0.2,     // v0-v5-v6-v1 up
    1, 0.2, 0.2,   1, 0.2, 0.2,   1, 0.2, 0.2,  1, 0.2, 0.2,     // v1-v6-v7-v2 left
    1, 0.2, 0.2,   1, 0.2, 0.2,   1, 0.2, 0.2,  1, 0.2, 0.2,     // v7-v4-v3-v2 down
    1, 0.2, 0.2,   1, 0.2, 0.2,   1, 0.2, 0.2,  1, 0.2, 0.2   // v4-v7-v6-v5 back
 ]);

  // Normal
  normals = new Float32Array([
    0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,  // v0-v1-v2-v3 front
    1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,  // v0-v3-v4-v5 right
    0.0, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.0,  // v0-v5-v6-v1 up
   -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  // v1-v6-v7-v2 left
    0.0,-1.0, 0.0,   0.0,-1.0, 0.0,   0.0,-1.0, 0.0,   0.0,-1.0, 0.0,  // v7-v4-v3-v2 down
    0.0, 0.0,-1.0,   0.0, 0.0,-1.0,   0.0, 0.0,-1.0,   0.0, 0.0,-1.0   // v4-v7-v6-v5 back
  ]);

  // Indices of the vertices
  indices = new Uint8Array([
    0, 1, 2,   0, 2, 3,    // front
    4, 5, 6,   4, 6, 7,    // right
    8, 9,10,   8,10,11,    // up
    12,13,14,  12,14,15,   // left
    16,17,18,  16,18,19,   // down
    20,21,22,  20,22,23    // back
 ]);

  // Write the vertex property to buffers (coordinates, colors and normals)
  if (!initArrayBuffer(gl, 'a_Position', vertices, 3, gl.FLOAT)) return -1;
  if (!initArrayBuffer(gl, 'a_Color', colors, 3, gl.FLOAT)) return -1;
  if (!initArrayBuffer(gl, 'a_Normal', normals, 3, gl.FLOAT)) return -1;

  // Unbind the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // Write the indices to the buffer object
  var indexBuffer = gl.createBuffer();
  if (!indexBuffer) {
    console.log('Failed to create the buffer object');
    return false;
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  return indices.length;
}

function initArrayBuffer(gl, attribute, data, num, type) {
  // Create a buffer object
  var buffer = gl.createBuffer();
  if (!buffer) {
    console.log('Failed to create the buffer object');
    return false;
  }
  // Write date into the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  // Assign the buffer object to the attribute variable
  var a_attribute = gl.getAttribLocation(gl.program, attribute);
  if (a_attribute < 0) {
    console.log('Failed to get the storage location of ' + attribute);
    return false;
  }
  gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);
  // Enable the assignment of the buffer object to the attribute variable
  gl.enableVertexAttribArray(a_attribute);

  return true;
}

function keypress(canvas, ev, gl){
  var u_shade_toggle = gl.getUniformLocation(gl.program, 'u_shade_toggle');
  if (ev.which == "a".charCodeAt(0)){
    gl.uniform1i(u_shade_toggle, 1);
  }
  else if (ev.which == "s".charCodeAt(0)){
    gl.uniform1i(u_shade_toggle, 0);
  }
  else if(ev.which == "i".charCodeAt(0)){ //positive z translate
    transModelMatrix.translate(0, 0, 0.5);
  }
  else if(ev.which == "k".charCodeAt(0)){ //negative z translate
    transModelMatrix.translate(0, 0, -0.5);
  }
  else if(ev.which == "j".charCodeAt(0)){ //positive z rotate
    rotModelMatrix.rotate(2, 0, 0, 1);
  }
  else if(ev.which == "l".charCodeAt(0)){ //negative z rotate
    rotModelMatrix.rotate(-2, 0, 0, 1);
  }
  else if(ev.which == "")
  drawCube(gl, canvas);
}

function keydown(canvas, ev, gl){
    if(ev.keyCode == 38){ //up
      scaleModelMatrix.scale(1.1, 1.1, 1.1);
    }
    else if(ev.keyCode == 40){  //down
      scaleModelMatrix.scale(0.9, 0.9, 0.9);
    }

    gl.clear(gl.COLOR_BUFFER_BIT);
    drawCube(gl, canvas);
}

function clickHandler(canvas, ev, gl){
  if(ev.button == 0){  //left click
    if(clickType == 0){  //click
      faceCalc(ev, gl, canvas);
    }
    else{ //drag
      changeMovement(canvas, ev, gl, 0);
      if(shouldMove == 0){
        translateCube(ev, gl, canvas);
      }
    }
  }
  else if(ev.button == 1){ //middle click
    if(clickType == 0){
      faceCalc(ev, gl, canvas);
      changeMovement(canvas, ev, gl, 0);
    }
    else{
    }
  }
  else if(ev.button == 2){ //right click
    if(clickType == 0){
      faceCalc(ev, gl, canvas);
      changeMovement(canvas, ev, gl, 0);
    }
    else{
      if(shouldMove == 0){
        rotateCube(ev, gl, canvas);
      }
    }
  }
  else{
    console.log(ev.button);
    console.log("Not a click");
  }
}

function dragFlag(canvas, ev, gl, flag){
  clickType = flag;
  if(flag == 0){  //click
    var x = ev.clientX, y = ev.clientY;
    var rect = ev.target.getBoundingClientRect();
    if (rect.left <= x && x < rect.right && rect.top <= y && y < rect.bottom) {
      var x_in_canvas = x - rect.left
      var y_in_canvas = rect.bottom - y;

      clickPixels = new Uint8Array(4);
      drawCube(gl, canvas);
      gl.readPixels(x_in_canvas, y_in_canvas, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, clickPixels);

      lastX = ((x - rect.left) - canvas.width/2)/(canvas.width/2);
      lastY = (canvas.height/2 - (y - rect.top))/(canvas.height/2);
    }  
  }
  clickHandler(canvas, ev, gl);
}

//Draws cubes from clicked points
function drawCube(gl, canvas){

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  var u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');

  var u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  var u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  var u_Picked = gl.getUniformLocation(gl.program, 'u_Picked');
  var u_Perspective = gl.getUniformLocation(gl.program, 'u_Perspective');

  var normalMatrix = new Matrix4(); // Transformation matrix for normals
  var projectionMatrix = new Matrix4();
  var viewMatrix = new Matrix4();

  var modelMatrix = new Matrix4();

  modelMatrix.multiply(transModelMatrix);
  modelMatrix.multiply(rotModelMatrix);
  modelMatrix.multiply(scaleModelMatrix);

  // Pass the model matrix to u_ModelMatrix
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

  // Pass the matrix to transform the normal based on the model matrix to u_NormalMatrix
  normalMatrix.setInverseOf(transModelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);

  if (!initArrayBuffer(gl, 'a_Position', vertices, 3, gl.FLOAT)) return -1;
  if (!initArrayBuffer(gl, 'a_Color', colors, 3, gl.FLOAT)) return -1;
  if (!initArrayBuffer(gl, 'a_Normal', normals, 3, gl.FLOAT)) return -1; 

  gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_BYTE, 0);
}

function translateCube(ev, gl, canvas){
  var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');

  var x = ev.clientX, y = ev.clientY;
  var rect = ev.target.getBoundingClientRect();
  if (rect.left <= x && x < rect.right && rect.top <= y && y < rect.bottom) {
    var x_in_canvas = x - rect.left
    var y_in_canvas = rect.bottom - y;

    x_in_canvas = ((x - rect.left) - canvas.width/2)/(canvas.width/2);
    y_in_canvas = (canvas.height/2 - (y - rect.top))/(canvas.height/2);

    if(clickPixels[0] > 0 || clickPixels[1] > 0 || clickPixels[2] > 0) {
      transModelMatrix.translate((x_in_canvas * .1), (y_in_canvas * .1), 0);
    }

    gl.clear(gl.COLOR_BUFFER_BIT);
    drawCube(gl, canvas);
  }
}
function rotateCube(ev, gl, canvas){
  var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');

  var x = ev.clientX, y = ev.clientY;
  var rect = ev.target.getBoundingClientRect();
  if (rect.left <= x && x < rect.right && rect.top <= y && y < rect.bottom) {
    var x_in_canvas = x - rect.left
    var y_in_canvas = rect.bottom - y;

    x_in_canvas = ((x - rect.left) - canvas.width/2)/(canvas.width/2);
    y_in_canvas = (canvas.height/2 - (y - rect.top))/(canvas.height/2);

    var angle; 
    if(x_in_canvas > lastX){
      angle = .05;
    }
    else{
      angle = -.05;
    }

    if(clickPixels[0] > 0 || clickPixels[1] > 0 || clickPixels[2] > 0) {
      rotModelMatrix.rotate(angle, 0, 0, 1);
    }

    gl.clear(gl.COLOR_BUFFER_BIT);
    drawCube(gl, canvas);
  }
}

function changeMovement(canvas, ev, gl, move){
  shouldMove = move;
}

function faceCalc(ev, gl, canvas) {   
  var u_Picked = gl.getUniformLocation(gl.program, 'u_Picked');
  var x = ev.clientX, y = ev.clientY;
  var rect = ev.target.getBoundingClientRect();
  if (rect.left <= x && x < rect.right && rect.top <= y && y < rect.bottom) {
    // If Clicked position is inside the <canvas>, update the selected surface
    var x_in_canvas = x - rect.left
    var y_in_canvas = rect.bottom - y;
    var object = checkPicked(gl, canvas, x_in_canvas, y_in_canvas, u_Picked);

    if(object[0] > 0 || object[1] > 0 || object[2] > 0){
      gl.uniform1i(u_Picked, 1);
    }
    else{
      gl.uniform1i(u_Picked, 0);
    }
    drawCube(gl, canvas);
  }
}

function checkPicked(gl, canvas, x, y, u_Picked){
  var pixels = new Uint8Array(4);
  gl.uniform1i(u_Picked, 1);
  drawCube(gl, canvas);
  gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  console.log(pixels);

  return pixels;
}

function rotateIndefinite(ev, gl, canvas){
  var tick = function(){
    currentAngle = animate(currentAngle) * .005;
    rotModelMatrix.rotate(currentAngle, 0, 1, 0);
    drawCube(gl, canvas);
    requestAnimationFrame(tick, canvas);
  }
  tick();
}

function applyGravity(ev, gl, canvas){
  var ticktock = function(){
    transModelMatrix.translate(0, -.8, 0);
    drawCube(gl, canvas);
    requestAnimationFrame(tick, canvas);
  }
  ticktock();
}

///---Copied from starter code---///
// Last time that this function was called
var g_last = Date.now();
function animate(angle) {
  // Calculate the elapsed time
  var now = Date.now();
  var elapsed = now - g_last;
  // g_last = now;
  // Update the current rotation angle (adjusted by the elapsed time)
  var newAngle = angle + (ANGLE_STEP * elapsed) / 1000.0;
  return newAngle %= 360;
}

function shearTransform(ev, gl, canvas){
  var shearMatrix = new Matrix4();
  shearMatrix.elements = new Float32Array([1, .5, .5, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  scaleModelMatrix.multiply(shearMatrix);

  drawCube(gl, canvas);
}

function moveCube(ev, gl, canvas){
  for(var i = 0; i < vertices.length; i++){
      if(i % 3 == 0){ //x coord
          vertices[i] -= 0.1;
      }
      if(i % 3 == 2){ //z coord
          vertices[i] -= 0.1;
      }
  }
  drawCube(gl, canvas);
}

function moveLight(ev, gl, canvas){
  var u_LightPosition = gl.getUniformLocation(gl.program, 'u_LightPosition');
  lightPosX += 0.1;
  gl.uniform3f(u_LightPosition, lightPosX, 4.0, 3.5);
  drawCube(gl, canvas);
}

function moveCamera(ev, gl, canvas){
  if(cameraToggle == 0){
    cameraX = 2;
    cameraY = 8;
    cameraToggle++;
  }
  else{
    cameraX = 6;
    cameraY = 6;
    cameraToggle--;
  }
  drawCube(gl, canvas);
}

function changeAmbient(ev, gl, canvas){
  gl.clear(gl.COLOR_BUFFER_BIT);
  var u_AmbientLight = gl.getUniformLocation(gl.program, 'u_AmbientLight');
  if(ambientCount % 3 == 0){
      gl.uniform3f(u_AmbientLight, 0.0, 0.0, 0.2);
      ambientCount++;
  }
  else if(ambientCount % 3 == 1){
      gl.uniform3f(u_AmbientLight, 0.0, 0.2, 0.0);
      ambientCount++;
  }
  else{
      gl.uniform3f(u_AmbientLight, 0.2, 0.0, 0.0);
      ambientCount++;
  }

  drawCube(gl, canvas);
}

function changeSpecular(ev, gl, canvas){
  gl.clear(gl.COLOR_BUFFER_BIT);
  var u_SpecularLight = gl.getUniformLocation(gl.program, 'u_SpecularLight');
  if(specCount % 3 == 0){
      gl.uniform3f(u_SpecularLight, 0.0, 0.0, 0.2);
      specCount++;
  }
  else if(specCount % 3 == 1){
      gl.uniform3f(u_SpecularLight, 0.0, 0.2, 0.0);
      specCount++;
  }
  else{
      gl.uniform3f(u_SpecularLight, 0.2, 0.0, 0.0);
      specCount++;
  }

  drawCube(gl, canvas);
}

function setGloss(ev, gl, canvas, slider){
  gl.clear(gl.COLOR_BUFFER_BIT);
  var u_shine = gl.getUniformLocation(gl.program, 'u_shine');
  var shine = slider.value;
  
  gl.uniform1f(u_shine, shine);

  drawCube(gl, canvas);
}

function setPlane(ev, gl, canvas, slider){
  gl.clear(gl.COLOR_BUFFER_BIT);
  nearPlane = slider.value;
  nearPlane = parseInt(nearPlane);

  drawCube(gl, canvas);
}

// loads SOR file and draws object
function updateScreen(canvas, gl) {
  canvas.onmousedown = null; // disable mouse
  var sor = readFile();      // get SOR from file
  setVertexBuffer(gl, new Float32Array(sor.vertices));
  setIndexBuffer(gl, new Uint16Array(sor.indexes));
  // clear canvas    
  gl.clear(gl.COLOR_BUFFER_BIT); 
  // draw model
  gl.drawElements(gl.POINTS, sor.indexes.length, gl.UNSIGNED_SHORT, 0);
  gl.drawElements(gl.LINE_STRIP, sor.indexes.length, gl.UNSIGNED_SHORT, 0);
}

// saves polyline displayed on canvas to file
function saveCanvas() {
  var sor = new SOR();
  sor.objName = "model";
  sor.vertices = g_points;
  sor.indexes = [];
  for (i = 0; i < g_points.length/3; i++)
  sor.indexes.push(i);
  console.log(sor.indexes);
  saveFile(sor);
}