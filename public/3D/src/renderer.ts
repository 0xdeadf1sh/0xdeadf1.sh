///////////////////////////////////////////////////////////////////////////
//////////// 3D: WebGPU Renderer for the Web by 0xdeadf1.sh ///////////////
///////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////
/////////////////////// CUSTOM EXCEPTION OBJECT ///////////////////////////
///////////////////////////////////////////////////////////////////////////
class D3Exception {

    ///////////////////////////////////////////////////////////////////////////
    public constructor(private m_class: string,
                       private m_function: string,
                       private m_msg: string) {}

    ///////////////////////////////////////////////////////////////////////////
    public toString(): string {
        return `D3Exception (class: ${this.m_class}) ` +
                           `(function: ${this.m_function}) ` +
                           `(message: ${this.m_msg})`;
    }

    ///////////////////////////////////////////////////////////////////////////
    public getClass(): string       { return this.m_class; }
    public getFunction(): string    { return this.m_function; }
    public getMessage(): string     { return this.m_msg; }
}

///////////////////////////////////////////////////////////////////////////
/////////////////////////////// RENDERER //////////////////////////////////
///////////////////////////////////////////////////////////////////////////
class D3Renderer {

    ///////////////////////////////////////////////////////////////////////////
    private readonly m_versionMajor: number = 0;
    private readonly m_versionMinor: number = 1;
    private readonly m_versionPatch: number = 0;

    ///////////////////////////////////////////////////////////////////////////
    private m_width: number                 = 0;
    private m_height: number                = 0;

    ///////////////////////////////////////////////////////////////////////////
    public static async create(canvasId: string): Promise<D3Renderer> {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            throw new D3Exception("D3Renderer",
                                  "create",
                                  `canvas id=${canvasId} not found`);
        }

        if (!navigator.gpu) {
            throw new D3Exception("D3Renderer",
                                  "create",
                                  "WebGPU not supported");
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new D3Exception("D3Renderer",
                                  "create",
                                  "requestAdapter() failed");
        }

        const device = await adapter.requestDevice();
        if (!device) {
            throw new D3Exception("D3Renderer",
                                  "create",
                                  "requestDevice() failed");
        }

        return new D3Renderer(canvas as HTMLCanvasElement);
    }

    ///////////////////////////////////////////////////////////////////////////
    private constructor(private m_canvas: HTMLCanvasElement) {
        this.resizeCanvas();
        this.resizeRenderToCanvas();
    }

    ///////////////////////////////////////////////////////////////////////////
    public resizeRenderToCanvas(): void {
        if (this.m_width !== this.m_canvas.width ||
            this.m_height !== this.m_canvas.height) {

            this.m_width = this.m_canvas.width;
            this.m_height = this.m_canvas.height;
        }
    }

    ///////////////////////////////////////////////////////////////////////////
    public resizeCanvas(): void {
        if (this.m_canvas.width !== this.m_canvas.clientWidth ||
            this.m_canvas.height !== this.m_canvas.clientHeight) {

            this.m_canvas.width = this.m_canvas.clientWidth;
            this.m_canvas.height = this.m_canvas.clientHeight;
        }
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
    const renderer = await D3Renderer.create("d3render");
    console.log(renderer.toString());
}

///////////////////////////////////////////////////////////////////////////
////////////////////////// PRETTY EXCEPTIONS //////////////////////////////
///////////////////////////////////////////////////////////////////////////
function showPrettyException(e: unknown): void {
    const exDiv = document.querySelector('#d3exception') as HTMLDivElement;
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

///////////////////////////////////////////////////////////////////////////
/////////////////////////////// ENTRY /////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
try {
    await main();
}
catch (e) {
    showPrettyException(e);
}
