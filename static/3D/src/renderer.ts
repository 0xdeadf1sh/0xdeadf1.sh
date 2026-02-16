///////////////////////////////////////////////////////////////////////////
//////////// 3D: WebGPU Renderer for the Web by 0xdeadf1.sh ///////////////
///////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////
///////////////////////////// DEPENDENCIES ////////////////////////////////
///////////////////////////////////////////////////////////////////////////
import * as WGPUtils from "webgpu-utils";
import * as Stats from "stats-js";
import * as DatGUI from "dat.gui";

///////////////////////////////////////////////////////////////////////////
/////////////////////// CUSTOM EXCEPTION OBJECT ///////////////////////////
///////////////////////////////////////////////////////////////////////////
export class D3Exception {

    ///////////////////////////////////////////////////////////////////////////
    public constructor(private m_class: string,
        private m_function: string,
        private m_msg: string) { }

    ///////////////////////////////////////////////////////////////////////////
    public toString(): string {
        return `D3Exception (class: ${this.m_class}) ` +
            `(function: ${this.m_function}) ` +
            `(message: ${this.m_msg})`;
    }

    ///////////////////////////////////////////////////////////////////////////
    public getClass(): string { return this.m_class; }
    public getFunction(): string { return this.m_function; }
    public getMessage(): string { return this.m_msg; }
}

///////////////////////////////////////////////////////////////////////////
//////////////////////// CUSTOM LOGGER OBJECT /////////////////////////////
///////////////////////////////////////////////////////////////////////////
export class D3Logger {

    ///////////////////////////////////////////////////////////////////////////
    private constructor() { }

    ///////////////////////////////////////////////////////////////////////////
    private static getTimeString(): string {
        const now = new Date();
        const timeString = `[D3Log] ` +
            `[${now.getHours()}` +
            `:${now.getMinutes()}` +
            `:${now.getSeconds()}` +
            `:${now.getMilliseconds()}]`;
        return timeString;
    }

    ///////////////////////////////////////////////////////////////////////////
    public static info(msg: string) {
        const timeString = D3Logger.getTimeString();
        console.log(`${timeString} : ${msg}`);
    }

    ///////////////////////////////////////////////////////////////////////////
    public static warn(msg: string) {
        const timeString = D3Logger.getTimeString();
        console.warn(`${timeString} : ${msg}`);
    }

    ///////////////////////////////////////////////////////////////////////////
    public static error(msg: string) {
        const timeString = D3Logger.getTimeString();
        console.error(`${timeString} : ${msg}`);
    }
};

///////////////////////////////////////////////////////////////////////////
/////////////////////////////// UTILITIES /////////////////////////////////
///////////////////////////////////////////////////////////////////////////
export class D3Utils {

    ///////////////////////////////////////////////////////////////////////////
    public static async fetchText(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new D3Exception("D3Utils",
                "fetchText",
                `could not fetch ${url}`);
        }
        return response.text();
    }

    ///////////////////////////////////////////////////////////////////////////
    public static showPrettyException(e: unknown): void {
        const exDiv = document.querySelector('#d3exception') as HTMLDivElement;
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

    ///////////////////////////////////////////////////////////////////////////
    public static packVec4F32ToU32(x: number,
        y: number,
        z: number,
        w: number): number {
        x = Math.round((Math.max(-1.0, Math.min(1.0, x)) * 127.0) & 0xFF);
        y = Math.round((Math.max(-1.0, Math.min(1.0, y)) * 127.0) & 0xFF);
        z = Math.round((Math.max(-1.0, Math.min(1.0, z)) * 127.0) & 0xFF);
        w = Math.round((Math.max(-1.0, Math.min(1.0, w)) * 127.0) & 0xFF);

        return (x << 0 |
            y << 8 |
            z << 16 |
            w << 24) >>> 0;
    }
}

///////////////////////////////////////////////////////////////////////////
///////////////////////////// RENDERER STATE //////////////////////////////
///////////////////////////////////////////////////////////////////////////
interface D3RendererState {
    readonly m_clearColor: Array<number>,
}

///////////////////////////////////////////////////////////////////////////
/////////////////////////////// RENDERER //////////////////////////////////
///////////////////////////////////////////////////////////////////////////
export class D3Renderer {

    ///////////////////////////////////////////////////////////////////////////
    private readonly m_versionMajor: number = 0;
    private readonly m_versionMinor: number = 1;
    private readonly m_versionPatch: number = 0;

    ///////////////////////////////////////////////////////////////////////////
    private m_lastTime: number = 0;

    ///////////////////////////////////////////////////////////////////////////
    private readonly m_devUI: DatGUI.GUI;

    ///////////////////////////////////////////////////////////////////////////
    private readonly m_state: D3RendererState;

    ///////////////////////////////////////////////////////////////////////////
    public static async create(canvasId: string,
        deviceLostCallback: (reason: GPUDeviceLostReason) => void): Promise<D3Renderer> {
        if (!navigator.gpu) {
            throw new D3Exception("D3Renderer",
                "create",
                "WebGPU not supported");
        }

        const adapterOptions: GPURequestAdapterOptions = {
            featureLevel: "core",
            forceFallbackAdapter: false,
            powerPreference: "high-performance",
            xrCompatible: false
        };

        const adapter = await navigator.gpu.requestAdapter(adapterOptions);
        if (!adapter) {
            throw new D3Exception("D3Renderer",
                "create",
                "requestAdapter() failed");
        }

        adapter.info.device && D3Logger.info(`Device: ${adapter.info.device}`);
        adapter.info.vendor && D3Logger.info(`Vendor: ${adapter.info.vendor}`);
        adapter.info.description && D3Logger.info(`Description: ${adapter.info.description}`);
        adapter.info.architecture && D3Logger.info(`Architecture: ${adapter.info.architecture}`);

        D3Logger.info(`Is fallback? : ${adapter.info.isFallbackAdapter}`);

        const defaultQueueDescriptor: GPUObjectDescriptorBase = {
            label: "D3Queue"
        };

        const deviceDescriptor: GPUDeviceDescriptor = {
            defaultQueue: defaultQueueDescriptor,
            label: "D3Device",
            requiredFeatures: [],
        };

        const device = await adapter.requestDevice(deviceDescriptor);
        if (!device) {
            throw new D3Exception("D3Renderer",
                "create",
                "requestDevice() failed");
        }

        device.lost.then(info => {
            deviceLostCallback(info.reason);
        });

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            throw new D3Exception("D3Renderer",
                "create",
                `canvas id=${canvasId} not found`);
        }

        const ctx = (canvas as HTMLCanvasElement).getContext("webgpu");
        if (!ctx) {
            throw new D3Exception("D3Renderer",
                "create",
                "getContext('webgpu') failed");
        }

        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        D3Logger.info(`Preferred canvas format: ${presentationFormat.toString()}`);

        const config: GPUCanvasConfiguration = {
            device,
            format: presentationFormat,
            colorSpace: "srgb",
        };

        ctx.configure(config);

        return new D3Renderer(navigator.gpu,
            adapter,
            device,
            canvas as HTMLCanvasElement,
            ctx);
    }

    ///////////////////////////////////////////////////////////////////////////
    private constructor(private m_gpu: GPU,
        private m_adapter: GPUAdapter,
        private m_device: GPUDevice,
        private m_canvas: HTMLCanvasElement,
        private m_ctx: GPUCanvasContext) {

        this.m_state = {
            m_clearColor: [10, 20, 10, 1.0],
        };

        this.m_devUI = new DatGUI.GUI({ name: "D3Renderer" });
        this.configureDevUI();
    }

    ///////////////////////////////////////////////////////////////////////////
    private configureDevUI(): void {
        const info = this.m_devUI.addFolder("Engine Info");

        const versionAll = {
            version: `${this.m_versionMajor}.${this.m_versionMinor}.${this.m_versionPatch}`
        };

        info.add(versionAll, "version")
            .domElement.style.pointerEvents = "none";;

        info.add(window, "devicePixelRatio")
            .listen()
            .domElement.style.pointerEvents = "none";

        info.add(this.m_canvas, "width")
            .listen()
            .domElement.style.pointerEvents = "none";

        info.add(this.m_canvas, "height")
            .listen()
            .domElement.style.pointerEvents = "none";

        info.add(this.m_adapter.limits, "maxBufferSize")
            .domElement.style.pointerEvents = "none";

        info.add(this.m_adapter.limits, "maxStorageBufferBindingSize")
            .domElement.style.pointerEvents = "none";

        info.open();

        const globalSettings = this.m_devUI.addFolder("Global Settings");
        globalSettings.addColor(this.m_state, "m_clearColor");
        globalSettings.open();
    }

    ///////////////////////////////////////////////////////////////////////////
    public async createShaderModule(label: string,
        shaderSrc: string): Promise<GPUShaderModule> {
        const desc: GPUShaderModuleDescriptor = {
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
                    throw new D3Exception("D3Renderer",
                        "createShaderModule",
                        `\n` +
                        `LineNo: ${info.lineNum}\n` +
                        `LinePos: ${info.linePos}\n` +
                        `Offset: : ${info.offset}\n` +
                        `Length: ${info.length}\n` +
                        `${info.message}`);
            }
        }

        return shaderModule;
    }

    ///////////////////////////////////////////////////////////////////////////
    public getCanvasTextureFormat(): GPUTextureFormat {
        return this.m_gpu.getPreferredCanvasFormat();
    }

    ///////////////////////////////////////////////////////////////////////////
    public getCanvasTextureView(label: string): GPUTextureView {
        const desc: GPUTextureViewDescriptor = {
            label,
        };
        return this.m_ctx.getCurrentTexture().createView(desc);
    }

    ///////////////////////////////////////////////////////////////////////////
    public async createRenderPipeline(label: string,
        shaderModule: GPUShaderModule,
        targets: Iterable<GPUColorTargetState>): Promise<GPURenderPipeline> {

        const desc: GPURenderPipelineDescriptor = {
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

    ///////////////////////////////////////////////////////////////////////////
    public createBuffer(label: string,
        size: number,
        usage: GPUBufferUsageFlags,
        mappedAtCreation: boolean): GPUBuffer {
        const desc: GPUBufferDescriptor = {
            label,
            size,
            usage,
            mappedAtCreation,
        };

        return this.m_device.createBuffer(desc);
    }

    ///////////////////////////////////////////////////////////////////////////
    public createBindGroup(label: string,
        bindGroupIndex: number,
        pipeline: GPUPipelineBase,
        buffers: Array<GPUBuffer>): GPUBindGroup {

        const entries: Array<GPUBindGroupEntry> = [];
        for (let i = 0; i < buffers.length; ++i) {

            const buff = buffers[i];
            if (!buff) {
                throw new D3Exception("D3Renderer",
                    "createBindGroup",
                    `buffers[${i}] is null`);
            }

            entries.push({
                binding: i,
                resource: {
                    buffer: buff,
                }
            });
        }

        const desc: GPUBindGroupDescriptor = {
            label,
            layout: pipeline.getBindGroupLayout(bindGroupIndex),
            entries,
        };

        return this.m_device.createBindGroup(desc);
    }

    ///////////////////////////////////////////////////////////////////////////
    public createCmdEncoder(label: string): GPUCommandEncoder {
        const desc: GPUCommandEncoderDescriptor = {
            label,
        };
        return this.m_device.createCommandEncoder(desc);
    }

    ///////////////////////////////////////////////////////////////////////////
    public submitCommandBuffers(buffers: Iterable<GPUCommandBuffer>): void {
        this.m_device.queue.submit(buffers);
    }

    ///////////////////////////////////////////////////////////////////////////
    public render(callback: (dt: number) => void): void {

        const stats = new Stats.Stats();
        stats.showPanel(0);
        document.body.appendChild(stats.dom);

        const renderInternal = () => {
            stats.begin();

            const now = performance.now();
            const dt = this.m_lastTime ? (performance.now() - this.m_lastTime) : 0.0;
            this.m_lastTime = now;

            callback(dt);

            stats.end();
            requestAnimationFrame(renderInternal);
        };
        requestAnimationFrame(renderInternal);
    }

    ///////////////////////////////////////////////////////////////////////////
    public resizeCanvas(callback: (w: number, h: number) => void): void {
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

    ///////////////////////////////////////////////////////////////////////////
    public writeBuffer(buffer: GPUBuffer,
        offset: number,
        data: ArrayBuffer): void {
        this.m_device.queue.writeBuffer(buffer, offset, data);
    }

    ///////////////////////////////////////////////////////////////////////////
    public printWgslInfo(): void {
        for (const feature of this.m_gpu.wgslLanguageFeatures) {
            D3Logger.info(feature);
        }
    }

    ///////////////////////////////////////////////////////////////////////////
    public printAdapterInfo(): void {
        D3Logger.info(`Device: ${this.m_adapter.info.device}`);
        D3Logger.info(`Vendor: ${this.m_adapter.info.vendor}`);
        D3Logger.info(`Description: ${this.m_adapter.info.description}`);
        D3Logger.info(`Architecture: ${this.m_adapter.info.architecture}`);
    }

    ///////////////////////////////////////////////////////////////////////////
    public getCanvasConfiguration(): GPUCanvasConfigurationOut | null {
        return this.m_ctx.getConfiguration();
    }

    ///////////////////////////////////////////////////////////////////////////
    public getClearColorNormalized(): Array<number> {
        const factor = 1.0 / 255;
        return [this.m_state.m_clearColor[0] ? this.m_state.m_clearColor[0] * factor : 0.0,
        this.m_state.m_clearColor[1] ? this.m_state.m_clearColor[1] * factor : 0.0,
        this.m_state.m_clearColor[2] ? this.m_state.m_clearColor[2] * factor : 0.0,
        this.m_state.m_clearColor[3] ? this.m_state.m_clearColor[3] * factor : 0.0];
    }

    ///////////////////////////////////////////////////////////////////////////
    public toString(): string {
        return `D3Renderer version: ${this.m_versionMajor}.` +
            `${this.m_versionMinor}.` +
            `${this.m_versionPatch}`;
    }
};

///////////////////////////////////////////////////////////////////////////
//////////////////////////////// MAIN /////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
async function main() {
    try {

        const renderer = await D3Renderer.create("d3render", reason => {
            switch (reason) {
                case "destroyed":
                    D3Utils.showPrettyException(new D3Exception("(none)",
                        "(deviceLostCallback)",
                        "Device intentionally lost"));
                    break;
                case "unknown":
                    D3Utils.showPrettyException(new D3Exception("(none)",
                        "(deviceLostCallback)",
                        "Please reload the page"));
                    break;
            }
        });

        const canvasFormat = renderer.getCanvasTextureFormat();

        const basicShaderSource = await D3Utils.fetchText("./shaders/basic.wgsl");
        const basicModule = await renderer.createShaderModule("D3_SHADER_BASIC", basicShaderSource);
        const basicPipeline = await renderer.createRenderPipeline("D3_SHADER_BASIC_PIPELINE",
            basicModule,
            [{ format: canvasFormat }]);

        const defs = WGPUtils.makeShaderDataDefinitions(basicShaderSource);

        const { size: vertexSSBOSize } =
            WGPUtils.getSizeAndAlignmentOfUnsizedArrayElement(defs.storages["vertices"] as WGPUtils.VariableDefinition);
        const { size: transformSSBOSize }
            = WGPUtils.getSizeAndAlignmentOfUnsizedArrayElement(defs.storages["transforms"] as WGPUtils.VariableDefinition);

        const vertexCount = 4;
        const vertexSSBOData = WGPUtils.makeStructuredView(defs.storages["vertices"] as WGPUtils.VariableDefinition,
            new ArrayBuffer(vertexCount * vertexSSBOSize));

        const instanceCount = 2;
        const transformSSBOData = WGPUtils.makeStructuredView(defs.storages["transforms"] as WGPUtils.VariableDefinition,
            new ArrayBuffer(instanceCount * transformSSBOSize));

        vertexSSBOData.set([{
            position: [D3Utils.packVec4F32ToU32(-0.5, -0.5, 0.0, 1.0)],
            color: [D3Utils.packVec4F32ToU32(1.0, 0.0, 0.0, 1.0)]
        }, {
            position: [D3Utils.packVec4F32ToU32(0.5, -0.5, 0.0, 1.0)],
            color: [D3Utils.packVec4F32ToU32(0.0, 1.0, 0.0, 1.0)]
        }, {
            position: [D3Utils.packVec4F32ToU32(-0.5, 0.5, 0.0, 1.0)],
            color: [D3Utils.packVec4F32ToU32(0.0, 0.0, 1.0, 0.0)]
        }, {
            position: [D3Utils.packVec4F32ToU32(0.5, 0.5, 0.0, 1.0)],
            color: [D3Utils.packVec4F32ToU32(1.0, 1.0, 0.0, 1.0)]
        }]);

        transformSSBOData.set([{
            offset: [-0.25, 0.0, 0.0, 0.0]
        }, {
            offset: [0.25, 0.0, 0.0, 0.0]
        }]);

        const vertexSSBO = renderer.createBuffer("VertexSSBO",
            vertexSSBOData.arrayBuffer.byteLength,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            false);
        renderer.writeBuffer(vertexSSBO, 0, vertexSSBOData.arrayBuffer);


        const transformSSBO = renderer.createBuffer("TransformSSBO",
            transformSSBOData.arrayBuffer.byteLength,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            false);
        renderer.writeBuffer(transformSSBO, 0, transformSSBOData.arrayBuffer);

        const eboData = new Uint16Array([
            0, 1, 2, 2, 1, 3,
        ]);
        const ebo = renderer.createBuffer("IndexBuffer",
            eboData.byteLength,
            GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            false);
        renderer.writeBuffer(ebo, 0, eboData.buffer);

        const bindGroup = renderer.createBindGroup("transform bind group",
            0,
            basicPipeline,
            [transformSSBO, vertexSSBO]);

        renderer.render(dt => {

            dt += 1;

            renderer.resizeCanvas((w: number, h: number) => {
                ++w;
                ++h;
            });

            const colorAttachment: GPURenderPassColorAttachment = {
                view: renderer.getCanvasTextureView("D3CanvasTextureView"),
                clearValue: renderer.getClearColorNormalized(),
                loadOp: "clear",
                storeOp: "store",
            };

            const renderpassDesc: GPURenderPassDescriptor = {
                label: "D3RenderpassDesc",
                colorAttachments: [colorAttachment],
            };

            const cmdEncoder = renderer.createCmdEncoder("D3CmdEncoder");
            const pass = cmdEncoder.beginRenderPass(renderpassDesc);

            pass.setPipeline(basicPipeline);
            pass.setBindGroup(0, bindGroup);
            pass.setIndexBuffer(ebo, "uint16");
            pass.drawIndexed(eboData.length, instanceCount);
            pass.end();

            const cmdBuffer = cmdEncoder.finish();
            renderer.submitCommandBuffers([cmdBuffer]);
        });
    }
    catch (e) {
        D3Utils.showPrettyException(e);
    }
}

///////////////////////////////////////////////////////////////////////////
/////////////////////////////// ENTRY /////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
main();
