struct VertexInput {
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
};

struct VertexSSBO {
    position: vec3f,
    color: vec3f,
};

struct TransformSSBO {
    offset: vec4f,
};

@group(0) @binding(0) var<storage, read> transforms: array<TransformSSBO>;
@group(0) @binding(1) var<storage, read> vertices: array<VertexSSBO>;

@vertex
fn vertex_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4f(vertices[input.vertexIndex].position, 1.0f) +
                      transforms[input.instanceIndex].offset;
    output.color = vec4f(vertices[input.vertexIndex].color, 1.0f);
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
