import * as WGPUtils from "webgpu-utils";
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
class D3Logger {
    constructor() { }
    static getTimeString() {
        const now = new Date();
        const timeString = `[D3Log] ` +
            `[${now.getHours()}` +
            `:${now.getMinutes()}` +
            `:${now.getSeconds()}` +
            `:${now.getMilliseconds()}]`;
        return timeString;
    }
    static info(msg) {
        const timeString = D3Logger.getTimeString();
        console.log(`${timeString} : ${msg}`);
    }
    static warn(msg) {
        const timeString = D3Logger.getTimeString();
        console.warn(`${timeString} : ${msg}`);
    }
    static error(msg) {
        const timeString = D3Logger.getTimeString();
        console.error(`${timeString} : ${msg}`);
    }
}
;
const D3_SHADER_BASIC = `
    struct VertexInput {
        @builtin(vertex_index) vertexIndex: u32,
    };

    struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
    };

    struct Transform {
        offset: vec4f,
    };

    @group(0) @binding(0) var<uniform> transform: Transform;

    @vertex
    fn vertex_main(input: VertexInput) -> VertexOutput {
        let positions = array(
            vec2f( 0.0f,  0.5f),
            vec2f(-0.5f, -0.5f),
            vec2f( 0.5f, -0.5f)
        );

        let colors = array(
            vec3f(1.0f, 0.0f, 0.0f),
            vec3f(0.0f, 1.0f, 0.0f),
            vec3f(0.0f, 0.0f, 1.0f)
        );

        var output: VertexOutput;
        output.position = vec4f(positions[input.vertexIndex], 0.0f, 1.0f) + transform.offset;
        output.color = vec4f(colors[input.vertexIndex], 1.0f);
        return output;
    }

    struct FragmentOutput {
        @location(0) color: vec4f,
    };

    @fragment
    fn fragment_main(input: VertexOutput) -> FragmentOutput {
        var output: FragmentOutput;
        output.color = input.color;
        return output;
    }
    `;
class D3Renderer {
    m_gpu;
    m_adapter;
    m_device;
    m_canvas;
    m_ctx;
    m_versionMajor = 0;
    m_versionMinor = 1;
    m_versionPatch = 0;
    m_lastTime = 0;
    static async create(canvasId, deviceLostCallback) {
        if (!navigator.gpu) {
            throw new D3Exception("D3Renderer", "create", "WebGPU not supported");
        }
        const adapterOptions = {
            featureLevel: "core",
            forceFallbackAdapter: false,
            powerPreference: "high-performance",
            xrCompatible: false
        };
        const adapter = await navigator.gpu.requestAdapter(adapterOptions);
        if (!adapter) {
            throw new D3Exception("D3Renderer", "create", "requestAdapter() failed");
        }
        adapter.info.device && D3Logger.info(`Device: ${adapter.info.device}`);
        adapter.info.vendor && D3Logger.info(`Vendor: ${adapter.info.vendor}`);
        adapter.info.description && D3Logger.info(`Description: ${adapter.info.description}`);
        adapter.info.architecture && D3Logger.info(`Architecture: ${adapter.info.architecture}`);
        D3Logger.info(`Is fallback? : ${adapter.info.isFallbackAdapter}`);
        const defaultQueueDescriptor = {
            label: "D3Queue"
        };
        const deviceDescriptor = {
            defaultQueue: defaultQueueDescriptor,
            label: "D3Device",
            requiredFeatures: [],
        };
        const device = await adapter.requestDevice(deviceDescriptor);
        if (!device) {
            throw new D3Exception("D3Renderer", "create", "requestDevice() failed");
        }
        device.lost.then(info => {
            deviceLostCallback(info.reason);
        });
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            throw new D3Exception("D3Renderer", "create", `canvas id=${canvasId} not found`);
        }
        const ctx = canvas.getContext("webgpu");
        if (!ctx) {
            throw new D3Exception("D3Renderer", "create", "getContext('webgpu') failed");
        }
        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        D3Logger.info(`Preferred canvas format: ${presentationFormat.toString()}`);
        const config = {
            device,
            format: presentationFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            alphaMode: "opaque",
            toneMapping: {
                "mode": "standard",
            },
            colorSpace: "srgb",
        };
        ctx.configure(config);
        return new D3Renderer(navigator.gpu, adapter, device, canvas, ctx);
    }
    constructor(m_gpu, m_adapter, m_device, m_canvas, m_ctx) {
        this.m_gpu = m_gpu;
        this.m_adapter = m_adapter;
        this.m_device = m_device;
        this.m_canvas = m_canvas;
        this.m_ctx = m_ctx;
    }
    async createShaderModule(label, shaderSrc) {
        const desc = {
            label,
            code: shaderSrc,
            compilationHints: [],
        };
        const shaderModule = this.m_device.createShaderModule(desc);
        const compInfo = await shaderModule.getCompilationInfo();
        for (const info of compInfo.messages) {
            switch (info.type) {
                case "info":
                    D3Logger.info(`\n` +
                        `LineNo: ${info.lineNum}\n` +
                        `LinePos: ${info.linePos}\n` +
                        `Offset: : ${info.offset}\n` +
                        `Length: ${info.length}\n` +
                        `${info.message}`);
                    break;
                case "warning":
                    D3Logger.warn(`\n` +
                        `LineNo: ${info.lineNum}\n` +
                        `LinePos: ${info.linePos}\n` +
                        `Offset: : ${info.offset}\n` +
                        `Length: ${info.length}\n` +
                        `${info.message}`);
                    break;
                case "error":
                    throw new D3Exception("D3Renderer", "createShaderModule", `\n` +
                        `LineNo: ${info.lineNum}\n` +
                        `LinePos: ${info.linePos}\n` +
                        `Offset: : ${info.offset}\n` +
                        `Length: ${info.length}\n` +
                        `${info.message}`);
            }
        }
        return shaderModule;
    }
    getCanvasTextureFormat() {
        return this.m_gpu.getPreferredCanvasFormat();
    }
    getCanvasTextureView(label) {
        const desc = {
            label,
        };
        return this.m_ctx.getCurrentTexture().createView(desc);
    }
    async createRenderPipeline(label, shaderModule, targets) {
        const desc = {
            label,
            layout: "auto",
            vertex: {
                module: shaderModule,
                entryPoint: "vertex_main",
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fragment_main",
                targets,
            },
        };
        return this.m_device.createRenderPipelineAsync(desc);
    }
    createBuffer(label, size, usage, mappedAtCreation) {
        const desc = {
            label,
            size,
            usage,
            mappedAtCreation,
        };
        return this.m_device.createBuffer(desc);
    }
    createBindGroup(label, bindGroupIndex, pipeline, ubos) {
        const entries = [];
        for (let i = 0; i < ubos.length; ++i) {
            const ubo = ubos[i];
            if (!ubo) {
                throw new D3Exception("D3Renderer", "createBindGroup", `ubos[${i}] is null`);
            }
            entries.push({
                binding: i,
                resource: {
                    buffer: ubo,
                }
            });
        }
        const desc = {
            label,
            layout: pipeline.getBindGroupLayout(bindGroupIndex),
            entries,
        };
        return this.m_device.createBindGroup(desc);
    }
    createCmdEncoder(label) {
        const desc = {
            label,
        };
        return this.m_device.createCommandEncoder(desc);
    }
    submitCommandBuffers(buffers) {
        this.m_device.queue.submit(buffers);
    }
    render(callback) {
        const renderInternal = () => {
            const now = performance.now();
            const dt = this.m_lastTime ? (performance.now() - this.m_lastTime) : 0.0;
            this.m_lastTime = now;
            callback(dt);
            requestAnimationFrame(renderInternal);
        };
        requestAnimationFrame(renderInternal);
    }
    resizeCanvas(callback) {
        if (this.m_canvas.width !== this.m_canvas.clientWidth ||
            this.m_canvas.height !== this.m_canvas.clientHeight) {
            let isCanvasSizeValid = true;
            this.m_canvas.width = this.m_canvas.clientWidth;
            if (this.m_canvas.width < 1 ||
                this.m_canvas.width > this.m_device.limits.maxTextureDimension2D) {
                D3Logger.warn(`Canvas size is out of range: ${this.m_canvas.width}`);
                isCanvasSizeValid = false;
            }
            this.m_canvas.height = this.m_canvas.clientHeight;
            if (this.m_canvas.height < 1 ||
                this.m_canvas.height > this.m_device.limits.maxTextureDimension2D) {
                D3Logger.warn(`Canvas size is out of range: ${this.m_canvas.height}`);
                isCanvasSizeValid = false;
            }
            if (isCanvasSizeValid) {
                callback(this.m_canvas.width, this.m_canvas.height);
            }
        }
    }
    writeBuffer(buffer, offset, data) {
        this.m_device.queue.writeBuffer(buffer, offset, data);
    }
    printWgslInfo() {
        for (const feature of this.m_gpu.wgslLanguageFeatures) {
            D3Logger.info(feature);
        }
    }
    printAdapterInfo() {
        D3Logger.info(`Device: ${this.m_adapter.info.device}`);
        D3Logger.info(`Vendor: ${this.m_adapter.info.vendor}`);
        D3Logger.info(`Description: ${this.m_adapter.info.description}`);
        D3Logger.info(`Architecture: ${this.m_adapter.info.architecture}`);
    }
    getCanvasConfiguration() {
        return this.m_ctx.getConfiguration();
    }
    toString() {
        return `D3Renderer version: ${this.m_versionMajor}.` +
            `${this.m_versionMinor}.` +
            `${this.m_versionPatch}`;
    }
}
;
async function main() {
    try {
        const renderer = await D3Renderer.create("d3render", reason => {
            switch (reason) {
                case "destroyed":
                    showPrettyException(new D3Exception("(none)", "(deviceLostCallback)", "Device intentionally lost"));
                    break;
                case "unknown":
                    showPrettyException(new D3Exception("(none)", "(deviceLostCallback)", "Please reload the page"));
                    break;
            }
        });
        const canvasFormat = renderer.getCanvasTextureFormat();
        const basicModule = await renderer.createShaderModule("D3_SHADER_BASIC", D3_SHADER_BASIC);
        const basicPipeline = await renderer.createRenderPipeline("D3_SHADER_BASIC_PIPELINE", basicModule, [{ format: canvasFormat }]);
        const defs = WGPUtils.makeShaderDataDefinitions(D3_SHADER_BASIC);
        const transformUBOData = WGPUtils.makeStructuredView(defs.uniforms["transform"]);
        const transformUBO = renderer.createBuffer("transformUBO", transformUBOData.arrayBuffer.byteLength, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, false);
        const bindGroup = renderer.createBindGroup("transform bind group", 0, basicPipeline, [transformUBO]);
        let clearRed = 0.0;
        let clearGreen = 0.0;
        let clearBlue = 0.0;
        let totalMS = 0.0;
        renderer.render(dt => {
            renderer.resizeCanvas((w, h) => {
                D3Logger.info(`Framebuffers resized to ${w}x${h}`);
            });
            totalMS += dt * 1e-3;
            clearRed = (Math.sin(totalMS) + 1.0) * 0.1;
            clearGreen = (Math.cos(totalMS) + 1.0) * 0.1;
            const colorAttachment = {
                view: renderer.getCanvasTextureView("D3CanvasTextureView"),
                clearValue: [clearRed, clearGreen, clearBlue, 1.0],
                loadOp: "clear",
                storeOp: "store",
            };
            const renderpassDesc = {
                label: "D3RenderpassDesc",
                colorAttachments: [colorAttachment],
            };
            const cmdEncoder = renderer.createCmdEncoder("D3CmdEncoder");
            const pass = cmdEncoder.beginRenderPass(renderpassDesc);
            transformUBOData.set({
                offset: [-0.5, 0.0, 0.0, 0.0],
            });
            renderer.writeBuffer(transformUBO, 0, transformUBOData.arrayBuffer);
            pass.setPipeline(basicPipeline);
            pass.setBindGroup(0, bindGroup);
            pass.draw(3);
            pass.end();
            const cmdBuffer = cmdEncoder.finish();
            renderer.submitCommandBuffers([cmdBuffer]);
        });
    }
    catch (e) {
        showPrettyException(e);
    }
}
function showPrettyException(e) {
    const exDiv = document.querySelector('#d3exception');
    if (!exDiv) {
        console.error('div#d3exception not found');
    }
    else if (e instanceof D3Exception) {
        exDiv.style.display = "block";
        exDiv.innerHTML = `<span id='d3exception'>!!! D3Exception !!!</span>` +
            `Class: ${e.getClass()} <br>` +
            `Function: ${e.getFunction()} <br>` +
            `Message: ${e.getMessage()}`;
    }
    else {
        console.error(e);
    }
}
main();
//# sourceMappingURL=renderer.js.map