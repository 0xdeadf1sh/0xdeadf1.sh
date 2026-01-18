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
