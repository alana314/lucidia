const canvas = document.getElementById('lucidiaCanvas');
const gl = canvas.getContext('webgl');
const controlBar = document.getElementById('controlBar');
const imageSelector = document.getElementById('imageSelector');
const fullscreenButton = document.getElementById('fullscreenButton');

let fadeProgress = 0;
let fading = false;
let currentTexture, nextTexture;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

const vertexShaderSource = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

uniform float u_rotation;

void main() {
    // Apply rotation to the position
    float cosRot = cos(u_rotation);
    float sinRot = sin(u_rotation);
    vec2 rotatedPosition = vec2(
        a_position.x * cosRot - a_position.y * sinRot,
        a_position.x * sinRot + a_position.y * cosRot
    );

    // Scale the position to zoom in
    gl_Position = vec4(rotatedPosition * 1.5, 0, 1); // Scale by 1.5 for zoom
    v_texCoord = a_texCoord;
}
`;

const fragmentShaderSource = `
precision mediump float;

uniform sampler2D u_image;
uniform sampler2D u_nextImage;
uniform float u_time;
uniform float u_fadeProgress;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;

    // Add more dramatic panning effect
    uv.x += sin(u_time * 0.5) * 0.2; // Increased horizontal panning
    uv.y += cos(u_time * 0.5) * 0.2; // Increased vertical panning

    // Distort UV coordinates with randomization
    float wave = sin(uv.y * 10.0 + u_time) * 0.02 + cos(uv.x * 15.0 + u_time * 0.5) * 0.01;
    uv.x += wave;

    wave = cos(uv.x * 10.0 + u_time) * 0.02 + sin(uv.y * 15.0 + u_time * 0.5) * 0.01;
    uv.y += wave;

    // Blend between current and next texture
    vec4 currentColor = texture2D(u_image, uv);
    vec4 nextColor = texture2D(u_nextImage, uv);
    gl_FragColor = mix(currentColor, nextColor, u_fadeProgress);
}
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const program = createProgram(gl, vertexShader, fragmentShader);

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1,
]), gl.STATIC_DRAW);

const texCoordBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 0,
    1, 0,
    0, 1,
    0, 1,
    1, 0,
    1, 1,
]), gl.STATIC_DRAW);

const positionLocation = gl.getAttribLocation(program, 'a_position');
const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
const timeLocation = gl.getUniformLocation(program, 'u_time');
const imageLocation = gl.getUniformLocation(program, 'u_image');
const rotationLocation = gl.getUniformLocation(program, 'u_rotation');
const nextImageLocation = gl.getUniformLocation(program, 'u_nextImage');
const fadeProgressLocation = gl.getUniformLocation(program, 'u_fadeProgress');

const images = [
    "./psychedelic1a.png",
    "./psychedelic2.png",
    "./bluedots.png",
    "./eyes.png",
    "./yellowlines.png",
];

let currentImageIndex = 0;
let nextImageIndex = 0;

function loadTexture(imageSrc) {
    const texture = gl.createTexture();
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    };
    return texture;
}

currentTexture = loadTexture(images[currentImageIndex]);
nextTexture = loadTexture(images[nextImageIndex]);

imageSelector.addEventListener('change', (e) => {
    nextImageIndex = parseInt(e.target.value);
    nextTexture = loadTexture(images[nextImageIndex]);
    fadeProgress = 0;
    fading = true;
});

fullscreenButton.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        canvas.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
});

let lastMouseMove = Date.now();
document.addEventListener('mousemove', () => {
    controlBar.classList.remove('hidden');
    lastMouseMove = Date.now();
});

setInterval(() => {
    if (Date.now() - lastMouseMove > 3000) {
        controlBar.classList.add('hidden');
    }
}, 100);

let rotation = 0;
let rotationSpeed = 0.001; // Initial rotation speed
let rotationAcceleration = 0.00001; // Acceleration factor

let viewRotation = 0; // Initial rotation angle
let viewRotationSpeed = 0.001; // Rotation speed

function render(time) {
    time *= 0.001; // Convert to seconds

    // Update rotation with acceleration and randomization
    rotationSpeed += rotationAcceleration;
    rotation += rotationSpeed;

    if (Math.random() < 0.01) {
        rotationAcceleration = (Math.random() - 0.5) * 0.0001; // Randomize acceleration
    }

    // Update view rotation
    viewRotation += viewRotationSpeed;

    // Handle fade progress
    if (fading) {
        fadeProgress += 0.01;
        if (fadeProgress >= 1) {
            fadeProgress = 1;
            fading = false;
            currentTexture = nextTexture;
        }
    }

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, time);
    gl.uniform1f(rotationLocation, viewRotation); // Pass rotation to the shader

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentTexture);
    gl.uniform1i(imageLocation, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, nextTexture);
    gl.uniform1i(nextImageLocation, 1);

    gl.uniform1f(fadeProgressLocation, fadeProgress);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(gl.getUniformLocation(program, 'u_time'), time + rotation);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}

// Start the rendering loop
requestAnimationFrame(render);

window.addEventListener('resize', resizeCanvas);
resizeCanvas();