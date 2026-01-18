export declare class D3Exception {
    private m_class;
    private m_function;
    private m_msg;
    constructor(m_class: string, m_function: string, m_msg: string);
    toString(): string;
    getClass(): string;
    getFunction(): string;
    getMessage(): string;
}
export declare class D3Logger {
    private constructor();
    private static getTimeString;
    static info(msg: string): void;
    static warn(msg: string): void;
    static error(msg: string): void;
}
export declare class D3Utils {
    static fetchText(url: string): Promise<string>;
    static showPrettyException(e: unknown): void;
    static packVec4F32ToU32(x: number, y: number, z: number, w: number): number;
}
export declare class D3Renderer {
    private m_gpu;
    private m_adapter;
    private m_device;
    private m_canvas;
    private m_ctx;
    private readonly m_versionMajor;
    private readonly m_versionMinor;
    private readonly m_versionPatch;
    private m_lastTime;
    private readonly m_devUI;
    private readonly m_state;
    static create(canvasId: string, deviceLostCallback: (reason: GPUDeviceLostReason) => void): Promise<D3Renderer>;
    private constructor();
    private configureDevUI;
    createShaderModule(label: string, shaderSrc: string): Promise<GPUShaderModule>;
    getCanvasTextureFormat(): GPUTextureFormat;
    getCanvasTextureView(label: string): GPUTextureView;
    createRenderPipeline(label: string, shaderModule: GPUShaderModule, targets: Iterable<GPUColorTargetState>): Promise<GPURenderPipeline>;
    createBuffer(label: string, size: number, usage: GPUBufferUsageFlags, mappedAtCreation: boolean): GPUBuffer;
    createBindGroup(label: string, bindGroupIndex: number, pipeline: GPUPipelineBase, buffers: Array<GPUBuffer>): GPUBindGroup;
    createCmdEncoder(label: string): GPUCommandEncoder;
    submitCommandBuffers(buffers: Iterable<GPUCommandBuffer>): void;
    render(callback: (dt: number) => void): void;
    resizeCanvas(callback: (w: number, h: number) => void): void;
    writeBuffer(buffer: GPUBuffer, offset: number, data: ArrayBuffer): void;
    printWgslInfo(): void;
    printAdapterInfo(): void;
    getCanvasConfiguration(): GPUCanvasConfigurationOut | null;
    getClearColorNormalized(): Array<number>;
    toString(): string;
}
//# sourceMappingURL=renderer.d.ts.map