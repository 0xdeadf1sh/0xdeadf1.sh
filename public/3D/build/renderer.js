class D3Exception {
    m_class;
    m_function;
    m_msg;
    constructor(m_class, m_function, m_msg) {
        this.m_class = m_class;
        this.m_function = m_function;
        this.m_msg = m_msg;
    }
    toString() {
        return `D3Exception (class: ${this.m_class}) ` +
            `(function: ${this.m_function}) ` +
            `(message: ${this.m_msg})`;
    }
    getClass() { return this.m_class; }
    getFunction() { return this.m_function; }
    getMessage() { return this.m_msg; }
}
class D3Renderer {
    m_canvas;
    m_versionMajor = 0;
    m_versionMinor = 1;
    m_versionPatch = 0;
    m_width = 0;
    m_height = 0;
    static async create(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            throw new D3Exception("D3Renderer", "create", `canvas id=${canvasId} not found`);
        }
        if (!navigator.gpu) {
            throw new D3Exception("D3Renderer", "create", "WebGPU not supported");
        }
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new D3Exception("D3Renderer", "create", "requestAdapter() failed");
        }
        const device = await adapter.requestDevice();
        if (!device) {
            throw new D3Exception("D3Renderer", "create", "requestDevice() failed");
        }
        return new D3Renderer(canvas);
    }
    constructor(m_canvas) {
        this.m_canvas = m_canvas;
        this.resizeCanvas();
        this.resizeRenderToCanvas();
    }
    resizeRenderToCanvas() {
        if (this.m_width !== this.m_canvas.width ||
            this.m_height !== this.m_canvas.height) {
            this.m_width = this.m_canvas.width;
            this.m_height = this.m_canvas.height;
        }
    }
    resizeCanvas() {
        if (this.m_canvas.width !== this.m_canvas.clientWidth ||
            this.m_canvas.height !== this.m_canvas.clientHeight) {
            this.m_canvas.width = this.m_canvas.clientWidth;
            this.m_canvas.height = this.m_canvas.clientHeight;
        }
    }
    toString() {
        return `D3Renderer version: ${this.m_versionMajor}.` +
            `${this.m_versionMinor}.` +
            `${this.m_versionPatch}`;
    }
}
;
async function main() {
    const renderer = await D3Renderer.create("d3render");
    console.log(renderer.toString());
}
function showPrettyException(e) {
    const exDiv = document.querySelector('#d3exception');
    if (!exDiv) {
        console.error('div#d3exception not found');
    }
    else if (e instanceof D3Exception) {
        exDiv.style.display = "block";
        exDiv.innerHTML = `============================================= <br>` +
            `<span id='d3exception'>D3Exception</span>` +
            `============================================= <br><br>` +
            `Class: ${e.getClass()} <br>` +
            `Function: ${e.getFunction()} <br>` +
            `Message: ${e.getMessage()}`;
    }
    else {
        console.error(e);
    }
}
try {
    await main();
}
catch (e) {
    showPrettyException(e);
}
export {};
//# sourceMappingURL=renderer.js.map