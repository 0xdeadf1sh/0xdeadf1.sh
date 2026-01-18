struct VertexInput {
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
};

struct VertexSSBO {
    position: u32,
    color: u32,
};

struct TransformSSBO {
    offset: vec4f,
};

@group(0) @binding(0) var<storage, read> transforms: array<TransformSSBO>;
@group(0) @binding(1) var<storage, read> vertices: array<VertexSSBO>;

@vertex
fn vertex_main(input: VertexInput) -> VertexOutput {

    var vertexPos = unpack4x8snorm(vertices[input.vertexIndex].position);
    var vertexColor = unpack4x8snorm(vertices[input.vertexIndex].color);

    var output: VertexOutput;
    output.position = vertexPos + transforms[input.instanceIndex].offset;
    output.color = vertexColor;
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
