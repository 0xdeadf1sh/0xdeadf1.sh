+++
date = '2026-01-18T23:53:22+04:00'
draft = false
title = 'Quantize Your Attributes!'
math = true
tags = ["optimization", "vulkan", "slang"]
showTags = true
readTime = true
+++

<!--more-->

![No VRAM](./img/no_vram.jpg#small)

I have seen a shader like this too often:

```cpp
struct VertexInput {
    uint vertexIndex : SV_VertexID;
    uint instanceIndex : SV_InstanceID;
};

struct VertexOutput {
    float4 position : SV_Position;
    float3 normal;
    float2 texcoord; 
};

struct VertexSSBO {
    float3 position;
    float3 normal;
    float2 texcoord;
};

StructuredBuffer<VertexSSBO> vertices;

[shader("vertex")]
VertexOutput vertex_main(VertexInput input) {
    VertexSSBO vData = vertices[input.vertexIndex];
    
    VertexOutput output;
    output.position = float4(vData.position, 1.0f);
    output.normal = vData.normal;
    output.texcoord = vData.texcoord;
    return output;
}
```

The example above is written in [Slang](https://shader-slang.org).
This is a simple vertex shader that pulls clip-space positions, normals,
and texture coordinates from an SSBO---not too different from what one
might find in a typical renderer, minus some matrix multiplications.
But it consumes too much bandwidth and VRAM. Can you find out why?

Notice that the struct `VertexSSBO` contains attributes specified as
vectors with floating-point members. How big is that? You might think
$4 * 3 + 4 * 3 + 4 * 2 = 32$ bytes. But according to
[std430](https://www.oreilly.com/library/view/opengl-programming-guide/9780132748445/app09lev1sec3.html) rules,
`float3` must be 16-byte aligned, and even though `float2` only needs
8-byte alignment, the entire `struct` must be aligned to its largest
member (16 bytes). This results in an effective size of 48 bytes due to internal and tail padding.
For a mesh containing 1 million vertices, that means 48 megabytes must be
transferred and maintained in VRAM. In Vulkan the transfer goes like this:

```cpp
void* data{};
vkMapMemory(device, stagingBufferMemory, 0, bufferSize, 0, &data);
memcpy(data, particles.data(), bufferSize);
vkUnmapMemory(device, stagingBufferMemory);
```

That is your CPU churning through 48 megabytes. You will also need a call to `vkCmdCopyBuffer`
to transfer those 48 megabytes from a staging buffer to a device buffer.

For most projects you don't need 32-bit precision. For simple low-poly meshes you can
probably even get away with 8-bit precision. Consider this:

```cpp
struct VertexInput {
    uint vertexIndex : SV_VertexID;
    uint instanceIndex : SV_InstanceID;
};

struct VertexOutput {
    float4 position : SV_Position;
    float3 normal;
    float2 texcoord; 
};

struct VertexSSBO {
    uint position;
    uint normal;
    uint texcoord;
};

StructuredBuffer<VertexSSBO> vertices;

[shader("vertex")]
VertexOutput vertex_main(VertexInput input) {
    VertexSSBO vData = vertices[input.vertexIndex];

    // de-quantize on the GPU
    float4 position = unpackSnorm4x8ToFloat(vData.position);
    float3 normal = unpackSnorm4x8ToFloat(vData.normal).xyz;
    float2 texcoord = unpackSnorm4x8ToFloat(vData.texcoord).xy;
    
    VertexOutput output;
    output.position = position;
    output.normal = normal;
    output.texcoord = texcoord;
    return output;
}
```

I used [unpackSnorm4x8ToFloat](https://docs.shader-slang.org/en/latest/external/core-module-reference/global-decls/unpacksnorm4x8tofloat-6eg.html)
to convert the quantized data back to float. 
For actual quantization, you may use:

```cpp
uint32_t p8(float v)
{
    v = (v > 1.0f) ? 1.0f : (v < -1.0f ? -1.0f : v);
    return (uint32_t)((int)roundf(v * 127.0f) & 0xFF);
}

uint32_t packVec4F32ToU32(float x, float y, float z, float w)
{
    return p8(x) | (p8(y) << 8) | (p8(z) << 16) | (p8(w) << 24);
}
```

So how much did we save? The new `struct` is $4 + 4 + 4 = 12$ bytes.
For a mesh with 1 million vertices, that is about
12 megabytes---75% reduction. Now you can use that saved VRAM for something actually
interesting, like higher-resolution [cascaded shadow maps](https://learnopengl.com/Guest-Articles/2021/CSM).

By the way, 8-bit quantization may be too aggressive for most meshes
(although usually fine for normals), so 16-bit would be better in practice (you may use the
[meshoptimizer library](https://github.com/zeux/meshoptimizer) for this).
[This demo](https://playcode.io/threejs-playground--019bd331-345a-70fd-aab4-e08e04b011cf)
shows what 8-bit quantization does to a sphere.

Also we have assumed that our attributes are normalized to the $[-1.0, 1.0]$ range. This may
not be true for a random model downloaded from the Internet, so some pre-processing may be
necessary.
