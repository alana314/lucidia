const canvas = document.getElementById('drempelsCanvas');
const gl = canvas.getContext('webgl');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

const vertexShaderSource = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0, 1);
    v_texCoord = a_texCoord;
}
`;

const fragmentShaderSource = `
precision mediump float;

uniform sampler2D u_image;
uniform float u_time;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;

    // Add panning effect
    uv.x += sin(u_time * 0.1) * 0.1; // Horizontal panning
    uv.y += cos(u_time * 0.1) * 0.1; // Vertical panning

    // Distort UV coordinates with randomization
    float wave = sin(uv.y * 10.0 + u_time) * 0.02 + cos(uv.x * 15.0 + u_time * 0.5) * 0.01;
    uv.x += wave;

    wave = cos(uv.x * 10.0 + u_time) * 0.02 + sin(uv.y * 15.0 + u_time * 0.5) * 0.01;
    uv.y += wave;

    // Sample the image with distorted UVs
    gl_FragColor = texture2D(u_image, uv);
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

const image = new Image();
image.src = "./psychedelic1.png"

let rotation = 0;
let rotationSpeed = 0.001; // Initial rotation speed
let rotationAcceleration = 0.00001; // Acceleration factor

image.onload = () => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    function render(time) {
        time *= 0.001; // Convert to seconds

        // Update rotation with acceleration and randomization
        rotationSpeed += rotationAcceleration;
        rotation += rotationSpeed;

        if (Math.random() < 0.01) {
            rotationAcceleration = (Math.random() - 0.5) * 0.0001; // Randomize acceleration
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

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(imageLocation, 0);

        // Apply rotation to the canvas
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(gl.getUniformLocation(program, 'u_time'), time + rotation);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
};

window.addEventListener('resize', resizeCanvas);
resizeCanvas();