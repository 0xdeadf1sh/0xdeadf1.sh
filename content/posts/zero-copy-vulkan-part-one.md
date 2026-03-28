+++
date = '2026-03-02T11:22:45+04:00'
draft = true
title = 'Zero Copy Vulkan (Part 1: Input)'
math = true
tags = ["optimization", "vulkan"]
showTags = true
readTime = true
toc = true
autonumber = true
+++

<!--more-->

> Note: The source code for this project is hosted at [Github](https://github.com/0xdeadf1sh/ZeroCopyVulkan).

## memcpy() is slow?

### Living on the edge

This is the first of a two-part series about using Vulkan more efficiently in embedded systems.
It's called "Part 1: Input" because we will concern ourselves mainly with feeding the GPU; the second part
will be called "Part 2: Output", where we will extract the processed image and then do something with it
(e.g. save it to disk, or stream it to the local network, etc., it's up to you).

To follow this tutorial you will need a Vulkan-capable GPU. I will be using [BananaPi M7](https://docs.banana-pi.org/en/BPI-M7/BananaPi_BPI-M7)
since it has [ARM Mali-G610](https://developer.arm.com/Processors/Mali-G610) that can run Vulkan 1.4 applications.

> Note: If you visit the link above you will see that the specification mentions Vulkan 1.2 as the most recent supported version,
but in this post we will use Mesa's [Panfrost](https://docs.mesa3d.org/drivers/panfrost.html) driver, which enables Vulkan 1.4.
I will also show how you can compile your own Vulkan drivers so that you get to enjoy the latest improvements and bug fixes
(not to mention being able to put breakpoints in the driver and observing what's happening under the hood---something that is
significantly harder to do with an OpenGL driver).

Another reason for choosing BananaPi M7 is that the sort of optimization that we will be implementing is done most often in embedded
devices, where the device needs to **consume** some data produced by a sensor (or multiple sensors), **process** it, and
**produce** the final output to be redirected somewhere else.

Below is an image of M7 next to an actual banana:

![BananaPi M7 next to a real banana](img/bananapim7.jpeg "Banana for scale")

This thing is **small**. It comes with a [Rockchip SoC (RK3588)](https://rockchips.net/product/rk3588/)
which, in addition to a GPU, also gives us an NPU, octa-core CPU,
and specialized hardware for image/video processing. We won't use the NPU (that will be another post in the future), but we *will*
use the hardware for encoding/decoding video frames, and of course Vulkan for doing the actual processing in the GPU.

### Installing Armbian

First, download the Armbian image for BananaPi M7 [here](https://www.armbian.com/bananapi-m7/). Make sure to select the BSP kernel
version, because we will need the appropriate kernel drivers for hardware acceleration. You may use the minimal version or an image
file that comes preinstalled with a desktop environment. I will be using `Armbian 26.2.1 Gnome`; if you use something else, the instructions
may be different---you will be **on your own**.

Flash the downloaded image to an SD card, for which you may use Armbian's own [flasher utility](https://github.com/armbian/imager/releases),
or [USBImager](https://bztsrc.gitlab.io/usbimager/). Then insert the SD card to BananaPi and let it boot. Follow the on-screen instructions.
Once you are presented with a GUI (or a tty console if you installed the minimal version), you will need to flash the image to internal storage
(which in my case is an eMMC storage). First, run the `lsblk` command to see a list of devices:

```bash
NAME         MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS
mmcblk1      179:0    0 29.7G  0 disk 
└─mmcblk1p1  179:1    0 29.4G  0 part /var/log.hdd
                                      /
mmcblk0      179:32   0 58.2G  0 disk 
└─mmcblk0p1  179:33   0 57.6G  0 part 
mmcblk0boot0 179:64   0    4M  1 disk 
mmcblk0boot1 179:96   0    4M  1 disk 
zram0        252:0    0  3.9G  0 disk [SWAP]
zram1        252:1    0   50M  0 disk /var/log
zram2        252:2    0    0B  0 disk
```

`/dev/mmcblk1` is the SD card, `/dev/mmcblk0` is the internal eMMC storage. Flash the armbian to eMMC using:

```bash
sudo armbian-install /dev/mmcblk0
```

Then choose `Boot from eMMC - system on eMMC` option in installer's menu.

Once the script finishes, it will ask us to power off the device. We will oblige. Before booting it up again, 
don't forget to remove the SD card from BananaPi.

### Installing dependencies

First things first, update the system with:

```bash
sudo apt update
sudo apt ugprade
```

If you don't like the default terminal emulator (Terminator), you may switch to gnome terminal by typing:

```bash
gsettings set org.gnome.desktop.default-applications.terminal exec 'gnome-terminal'
```

Now install the required packages:

```bash
sudo apt install build-essential                \
                 cmake                          \
                 pkg-config                     \
                 git                            \
                 git-lfs                        \
                 gdb                            \
                 gcc-14                         \
                 g++-14                         \
                 vulkan-tools                   \
```

We need `g++-14` because we will be using C++23 features like [designated initializers](https://en.cppreference.com/w/cpp/language/aggregate_initialization.html).
In your `~/.bashrc`, add the following lines:

```bash
alias gcc='gcc-14'
alias g++='g++-14'
```

If you type `vulkaninfo` now, you will get something like:

```bash
ERROR: [Loader Message] Code 0 : vkCreateInstance: Found no drivers!
Cannot create Vulkan instance.
This problem is often caused by a faulty installation of the Vulkan driver or attempting to use a GPU that does not support Vulkan.
ERROR at ./vulkaninfo/./vulkaninfo.h:458:vkCreateInstance failed with ERROR_INCOMPATIBLE_DRIVER
```

That's OK, we haven't compiled the driver yet.

> Note: To follow this tutorial, you will also need to install a text editor. I will be using neovim, and if you want to use it too,
don't install it through the package manager (it's too old). Instead, download the latest version from the [official website](https://neovim.io/).

Now grab Mesa's source code from the [archive](https://archive.mesa3d.org/):

```bash
wget https://archive.mesa3d.org/mesa-26.0.1.tar.xz
```

> Note: You may use a newer version if it is available, but make sure to check if it is compatible with the kernel version that you have installed
(this would be the BSP kernel in our case). Incompatible versions will make `vulkaninfo` output the `ERROR` message above.

Unpack it:

```bash
tar xvf mesa-26.0.1.tar.xz
```

Mesa uses [meson](https://mesonbuild.com/) as its build system, but the pre-packaged version in Armbian is too old,
so we will grab the latest one:

```bash
wget https://github.com/mesonbuild/meson/releases/download/1.10.1/meson-1.10.1.tar.gz
```

Unpack it:

```bash
tar xvf meson-1.10.1.tar.gz
```

> Note: It's convenient to have meson in the PATH; here's how I did it:
> First, I created a directory called `~/Bin` and added it to the PATH:

```bash
mkdir ~/Bin
echo 'export PATH=$HOME/Bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

> Then I created a symlink to the meson executable in the `~/Bin` directory:
```bash
cd ~/Bin
ln -s ~/meson-1.10.1/meson.py meson
```

> Now when I type `meson --version`, I get `1.10.1`. Anything that I put in `~/Bin` automatically becomes
available for use in the terminal.

Install Mesa's dependencies (I will build a Wayland-only variant, even though we won't be rendering
anything to a window in this tutorial, but it may come handy in the future):

```bash
sudo apt install python3-mako               \
                 glslang-tools              \
                 libclc-18-dev              \
                 llvm-18-dev                \
                 libllvmspirvlib-18-dev     \
                 libclang-18-dev            \
                 libwayland-dev             \
                 libwayland-egl-backend-dev \
                 libdrm-dev                 \
                 ninja-build
```

Then `cd` into the Mesa source directory and run:

```bash
meson setup build -Dplatforms=wayland           \
                  -Dgallium-drivers=panfrost    \
                  -Dvulkan-drivers=panfrost     \
                  -Dtools=panfrost              \
                  -Dvulkan-beta=true            \
                  -Dvideo-codecs=all            \
                  -Dglx=disabled                \
                  --buildtype debugoptimized
```

The last option `--buildtype debugoptimized` will give us an optimized build with debugging symbols---very useful
when debugging through `GDB`.

Now type:

```bash
meson compile -C build
```

This will build the [Panfrost driver stack](https://docs.mesa3d.org/drivers/panfrost.html), which also contains
PanVK---Vulkan driver for the Arm Mali G610 GPU.

We need to tell the Vulkan apps in our system where to find the driver. Append the line below to your `~/.bashrc`:

```bash
export VK_DRIVER_FILES=$HOME/Desktop/mesa-26.0.1/build/src/panfrost/vulkan/panfrost_devenv_icd.aarch64.json
```

> Note: I put the Mesa source code in `~/Desktop`; you may need to adjust it based on where your Mesa build directory
is located.

Type:

```bash
source ~/.bashrc
```

Now `vulkaninfo | grep apiVersion` should return:

```bash
apiVersion: 1.4.335 (4211023)
```

> Note: Your last three digits may be different, that's fine as long as the version is at least 1.4.

If you are wondering what that 4211023 is, it is the 32-bit unsigned integer representation of the version. Vulkan uses
a macro called [VK_MAKE_VERSION](https://docs.vulkan.org/refpages/latest/refpages/source/VK_MAKE_VERSION.html) to
pack the components of its version (major, minor, patch) of the API in a single 32-bit integer. Here's how it is defined:

```cpp
#define VK_MAKE_VERSION(major, minor, patch) \
    ((((uint32_t)(major)) << 22U) | (((uint32_t)(minor)) << 12U) | ((uint32_t)(patch)))
```

To check that I am not actually lying, write the following C program called `test.c`:

```c
#include <vulkan/vulkan.h>
#include <stdio.h>

int main(void)
{
    printf("%u\n", VK_MAKE_VERSION(1, 4, 335));

    return 0;
}
```

Then compile and run it:

```bash
gcc test.c
./a.out
4211023
```

To actually use Vulkan functions (including extensions), we need to load them. We will use [volk](https://github.com/zeux/volk):

```bash
git clone --depth=1 https://github.com/zeux/volk
cd volk
gcc -O2 -march=native -g -c volk.c -o libvolk.a
```

The `libvulkan1` package that came pre-installed with Armbian is too old, so we will fetch three additional repositories and
build the vulkan loader and the validation layers:

```bash
git clone --depth=1 https://github.com/KhronosGroup/Vulkan-Headers
git clone --depth=1 https://github.com/KhronosGroup/Vulkan-Loader
git clone --depth=1 https://github.com/KhronosGroup/Vulkan-ValidationLayers
```

First, we install the headers:

```bash
cd Vulkan-Headers
cmake -S . -B build
sudo cmake --install build
```

Then, we build the loader:

```bash
cd Vulkan-Loader
cmake -B build -DBUILD_WSI_XCB_SUPPORT=OFF -DBUILD_WSI_XLIB_SUPPORT=OFF -DBUILD_WSI_XLIB_XRANDR_SUPPORT=OFF -DCMAKE_BUILD_TYPE=RelWithDebInfo .
cmake --build build -j8
```

Then the validation layers:

```bash
cd Vulkan-ValidationLayers
cmake -B build -DBUILD_WSI_XCB_SUPPORT=OFF -DBUILD_WSI_XLIB_SUPPORT=OFF -DBUILD_WSI_XLIB_XRANDR_SUPPORT=OFF -DCMAKE_BUILD_TYPE=RelWithDebInfo .
cmake --build build -j8
```

Note that I didn't install the loader and the validation layers. Instead I will put them inside the `lib` directory of our project.

I will use [EASTL](https://github.com/electronicarts/EASTL)---I prefer it to C++'s standard library because of its emphasis
on performance and some additional data structures that it provides:

```bash
git clone --depth=1 https://github.com/electronicarts/EASTL
```

[EASTL](https://github.com/electronicarts/EASTL) depends on [EABase](https://github.com/electronicarts/EABase), so fetch it too:

```bash
git clone --depth=1 https://github.com/electronicarts/EABase
```

Now build EASTL:

```bash
cd EASTL
cmake -B build -DCMAKE_BUILD_TYPE=RelWithDebInfo .
cmake --build build -j8
```

For image processing, we will write a compute shader, so download [Slang](https://shader-slang.org/) and unpack it:

```bash
wget https://github.com/shader-slang/slang/releases/download/v2026.3.1/slang-2026.3.1-linux-aarch64.tar.gz
mkdir slang && cd slang
tar xvf ../slang-2026.3.1-linux-aarch64.tar.gz
```

> Note: Vulkan drivers consume bytecode called [SPIR-V](https://docs.vulkan.org/guide/latest/what_is_spirv.html),
which means that technically you can use any shading language whose compiler can output SPIR-V bytecode. I chose Slang because I like it :)

For convenience, I created symlinks to slang executables in the `~/Bin` directory:

```bash
cd ~/Bin
ln -s $HOME/Desktop/slang/bin/slangc slangc
ln -s $HOME/Desktop/slang/bin/slangd slangd
ln -s $HOME/Desktop/slang/bin/slangi slangi
```

Now when I type `slangc -version`, I get:

```bash
2026.3.1
```

We will also be using [GStreamer](https://gstreamer.freedesktop.org/) for fetching video frames from a camera and streaming the output
of the GPU to the local network (explained in the next chapter):

```bash
sudo apt install gstreamer1.0-plugins-base          \
                 gstreamer1.0-plugins-base-apps     \
                 gstreamer1.0-plugins-good          \
                 gstreamer1.0-plugins-bad           \
                 gstreamer1.0-plugins-bad-apps      \
                 gstreamer1.0-plugins-ugly          \
                 libgstreamer1.0-0                  \
                 libgstreamer1.0-dev                \
                 libgstreamer-plugins-good1.0-dev   \
                 libgstreamer-plugins-base1.0-dev   \
                 libgstreamer-plugins-bad1.0-dev    \
                 gstreamer1.0-rtsp                  \
                 gstreamer1.0-tools                 \
                 gstreamer1.0-rockchip1
```

The most important package is `gstreamer1.0-rockchip1`---it will allow us to use Rockchip's hardware facilities for
image and video processing.

Rockchip comes with a [specialized hardware](https://github.com/yanyitech/rga) for 2D image processing, which we can
interface with using the RGA library:

```bash
sudo apt install librga-dev
```

### The Problem

As explained in the beginning of this tutorial, embedded devices are often used to **consume** some data from a sensor, **process** it,
and **produce** the final output to be redirected elsewhere. Here's what we are trying to achieve:

![The Problem Outline](img/gst_slow_pipeline.png "General outline of what we are trying to achieve")

1. First, the camera output is received by the hardware decoder block and converted into raw RGB pixels.
2. Then we fetch the raw output of the decoder and store it in RAM.
3. We transfer the image from RAM to GPU's VRAM to be processed by the compute shader.
4. We copy the output of the GPU and store the new image in RAM.
5. Then we send this new image to the hardware encoder block, which will compress it to an H265 video.
6. Finally, the video is streamed to the local network.

Technically speaking the output of the encoder would go to the network adapter (the encoder itself can't stream its output to the local network),
but you get the idea.

That's 4 `memcpy()` operations in total! But is it the fastest way of solving this problem? Let's figure it out. First, we will write the implementation,
then profile it to find out how fast (or slow) `memcpy()` can be.

### Setting up the camera

You can use any camera for this project. I am using a cheap USB camera, which should suffice.

When the camera is plugged to the USB port, it shows up as a new device at `/dev/video0`. We can use the `v4l2-ctl` command to find which formats it supports:

```bash
v4l2-ctl -d /dev/video0 --list-formats-ext
```

In my case it produces a very long list of supported formats and resolutions. I am interested mainly in the following:

```bash
[0]: 'MJPG' (Motion-JPEG, compressed)
	Size: Discrete 1920x1080
		Interval: Discrete 0.033s (30.000 fps)
		Interval: Discrete 0.040s (25.000 fps)
		Interval: Discrete 0.050s (20.000 fps)
		Interval: Discrete 0.067s (15.000 fps)
		Interval: Discrete 0.100s (10.000 fps)
		Interval: Discrete 0.200s (5.000 fps)
```

This is a standard Full HD video made of JPEG frames. Luckily for us, the [Rockchip SoC](https://wiki.friendlyelec.com/wiki/images/e/ee/Rockchip_RK3588_Datasheet_V1.6-20231016.pdf)
in BananaPi comes with a hardware block for decoding JPEG images. So we won't need to decode it ourselves in the CPU, which would be slow. The hardware can decode 1080p video
up to 280 FPS, which is more than enough for us.

### Setting up the project

I will use [CMake](https://cmake.org/download/) to generate the build files---which means we need a `CMakeLists.txt`:

```cmake
cmake_minimum_required(VERSION 3.10)

set(CMAKE_CXX_STANDARD              23)
set(CMAKE_CXX_STANDARD_REQUIRED     True)
set(CMAKE_CXX_EXTENSIONS            OFF)
set(CMAKE_C_COMPILER                /usr/bin/gcc-14)
set(CMAKE_CXX_COMPILER              /usr/bin/g++-14)

project(ZeroCopyVulkan              VERSION 0.1)

set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY  ${CMAKE_BINARY_DIR}/${CMAKE_CFG_INTDIR})
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY  ${CMAKE_BINARY_DIR}/${CMAKE_CFG_INTDIR})
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY  ${CMAKE_BINARY_DIR}/${CMAKE_CFG_INTDIR})
set(CMAKE_EXPORT_COMPILE_COMMANDS   ON)

set(TP_LIB_DIR                      ${CMAKE_SOURCE_DIR}/lib)

include(${CMAKE_SOURCE_DIR}/compile_flags.cmake)

find_package(PkgConfig REQUIRED)
pkg_check_modules(GST_APP REQUIRED  gstreamer-1.0
                                    gstreamer-app-1.0
                                    gstreamer-allocators-1.0
                                    glib-2.0)

add_executable("${PROJECT_NAME}"
    ${CMAKE_SOURCE_DIR}/src/memcpy.cpp
    ${CMAKE_SOURCE_DIR}/src/zero-copy.cpp
    ${CMAKE_SOURCE_DIR}/src/memory.cpp
    ${CMAKE_SOURCE_DIR}/src/main.cpp
)

target_link_directories("${PROJECT_NAME}" PRIVATE ${TP_LIB_DIR})

target_compile_options("${PROJECT_NAME}" PRIVATE ${COMMON_COMPILER_FLAGS})
target_compile_options("${PROJECT_NAME}" PRIVATE
    $<$<CONFIG:Debug>:${DEBUG_COMPILER_FLAGS}>
    $<$<CONFIG:Release>:${RELEASE_COMPILER_FLAGS}>
)

target_link_options("${PROJECT_NAME}" PRIVATE ${COMMON_LINKER_FLAGS})
target_link_options("${PROJECT_NAME}" PRIVATE
    $<$<CONFIG:Debug>:${DEBUG_LINKER_FLAGS}>
    $<$<CONFIG:Release>:${RELEASE_LINKER_FLAGS}>
)

target_include_directories("${PROJECT_NAME}" SYSTEM PUBLIC include)
target_include_directories("${PROJECT_NAME}" SYSTEM PUBLIC ${GST_APP_INCLUDE_DIRS})

find_library(RGA NAMES rga PATHS /usr/lib/aarch64-linux-gnu REQUIRED)
target_link_libraries("${PROJECT_NAME}" PRIVATE ${RGA})

function(find_and_link_library LIB_NAME)
    string(TOUPPER ${LIB_NAME} LIB_VAR)
    find_library(${LIB_VAR} NAMES ${LIB_NAME} PATHS ${TP_LIB_DIR} NO_DEFAULT_PATH)
    if(${LIB_VAR})
        target_link_libraries("${PROJECT_NAME}" PRIVATE ${${LIB_VAR}})
    else()
        message(FATAL_ERROR "Could not find ${LIB_NAME}")
    endif()
endfunction()

find_and_link_library(EASTL)
find_and_link_library(volk)
```

> Note: If you are wondering what that `include(${CMAKE_SOURCE_DIR}/compile_flags.cmake)` is,
I have basically put the compiler and linker flags in a different cmake file, so that we don't
clutter the main build script.

The build script above does a few things:

- It sets the C++ standard to 23
- Disables compiler extensions
- Sets the compiler to a version that supports C++ version 23 (in our case, `g++-14`)
- Makes sure that CMake doesn't clutter the root directory of our project
- Sets the library directory to `lib`
- Includes compiler and linker flags from a separate file (to be shown later)
- Searches for GStreamer libraries in the system
- Specifies the source code files of the project
- Sets different compiler and linker flags depending on whether we are building for `debug` or `release`
- Sets the appropriate header files as `SYSTEM` (this means that our custom compiler flags won't apply to them---later you will see why we need it)
- Finds the `RGA` library in the system and links to it
- Defines a function called `find_and_link_library` used for finding and linking libraries in the `lib` directory

The script could have been writter better, sure, namely the code for finding the C++23-capable compiler can be
refactored to something that can work across systems, but for our purposes setting the compiler path to `/usr/bin/g++-14` is good enough.

Below is the `compile_flags.cmake` (despite its name, it also contains the linker flags):

```cmake
set(COMMON_COMPILER_FLAGS
    "-DEASTL_STRING_EXPLICIT"            # make string ctor explicit
    "-DEASTL_EXCEPTIONS_ENABLED=0"       # disable exceptions

    "-save-temps"
    "-march=native"

    "-g"
    "-Wall"
    "-Wextra"
    "-Werror"
    "-Wformat"
    "-Wformat=2"
    "-Wformat-security"
    "-Whardened"
    "-Wconversion"
    "-Wsign-conversion"
    "-Wfloat-equal"
    "-Wimplicit-fallthrough"
    "-Wbidi-chars=any"
    "-Wundef"
    "-Wnull-dereference"
    "-Wunused-variable"
    "-Wshadow"
    "-Wpointer-arith"
    "-Wwrite-strings" 
    "-Wunreachable-code"
    "-Winit-self"
    "-Wnon-virtual-dtor"
    "-Wdeprecated"
    "-Wold-style-cast"
    "-Wsuggest-override"
    "-Wmisleading-indentation"
    "-Wparentheses"
    "-Wlogical-op"
    "-Wattributes"
    "-Wuseless-cast"
    "-Wcast-qual"
    "-Wcast-align"
    "-Wmissing-include-dirs"
    "-Wredundant-decls"
    "-D_GLIBCXX_ASSERTIONS"
    "-U_FORTIFY_SOURCE"
    "-D_FORTIFY_SOURCE=3"
    "-fstrict-flex-arrays=3"
    "-fstack-clash-protection"
    "-fstack-protector-strong"
    "-mbranch-protection=standard"
    "-Wl,-z,nodlopen"
    "-Wl,-z,noexecstack"
    "-Wl,-z,relro"
    "-Wl,-z,now"
    "-Wl,--as-needed"
    "-Wl,--no-copy-dt-needed-entries"
    "-fno-delete-null-pointer-checks"
    "-fno-strict-overflow"
    "-fno-strict-aliasing"
    "-ftrivial-auto-var-init=zero"
    "-fno-exceptions"
    "-fno-rtti"
)

set(DEBUG_COMPILER_FLAGS
    "-Og"
    "-D_DEBUG"
    "-fverbose-asm"
)

set(RELEASE_COMPILER_FLAGS
    "-O2"
    "-D_RELEASE"
)

set(COMMON_LINKER_FLAGS
    "-Wl,-z,nodlopen"
    "-Wl,-z,noexecstack"
    "-Wl,-z,relro"
    "-Wl,-z,now"
    "-Wl,--as-needed"
    "-Wl,--no-copy-dt-needed-entries"
)

set(DEBUG_LINKER_FLAGS
)

set(RELEASE_LINKER_FLAGS
    "-flto"
)
```

Embedded software is often pilloried for security issues, so I have decided to enable
[OpenSSF's recommendations](https://best.openssf.org/Compiler-Hardening-Guides/Compiler-Options-Hardening-Guide-for-C-and-C++.html)
for compiler flags designed to improve security.

There are a few additional notes about `compile_flags.cmake`:

- EASTL by default implicitly converts `char*` to a `string` object, causing a heap allocation where none was necessary.
We can turn this off by defining `EASTL_STRING_EXPLICIT`. You can read more about it [here](https://github.com/electronicarts/EASTL/blob/master/doc/Gotchas.md#char-converts-to-string-silently)
- We are disabling exceptions and RTTI (often the case for embedded projects), since they may incur performance penalties that we won't tolerate. We also need to tell EASTL about this,
which is what `EASTL_EXCEPTIONS_ENABLED=0` does. You can read about arguments for and against exceptions [here](http://shanekirk.com/2015/06/c-exceptions-the-good-the-bad-and-the-ugly/). If you do want
to use exceptions, then you need to remove the lines containing `EASTL_EXCEPTIONS_ENABLED=0` and `-fno-exceptions`
- Debugging symbols are present in release builds too. We can always remove them using the `strip` command
- No [RTTI](https://pvs-studio.com/en/blog/posts/cpp/0998/), so no `dynamic_cast`

The project structure is as follows:

```bash
./
├── include/
│   ├── EABase/
│   ├── EASTL/
│   └── volk/
├── lib/
│   ├── libEASTL.a
│   ├── libVkLayer_khronos_validation.so*
│   ├── libvolk.a
│   ├── libvulkan.so*
├── src/
│   ├── ivalid.hpp
│   ├── main.cpp
│   ├── memcpy.cpp
│   ├── memcpy.hpp
│   ├── memory.cpp
│   ├── util.hpp
│   ├── zero-copy.cpp
│   └── zero-copy.hpp
├── CMakeLists.txt
├── compile_flags.cmake
└── compile_flags.txt
```

EASTL expects custom `new` and `new[]` functions with specific parameters. So `memory.cpp` defines them:

```cpp
// memory.cpp

#include <cstddef>
#include <cstdlib>

///////////////////////////////////////////////////////////////////////////
void* operator new[](size_t size,
                     [[maybe_unused]] const char* pName,
                     [[maybe_unused]] int flags,
                     [[maybe_unused]] unsigned debugFlags,
                     [[maybe_unused]] const char* file,
                     [[maybe_unused]] int line)
{
    return malloc(size);
}

///////////////////////////////////////////////////////////////////////////
void* operator new[](size_t size,
                     size_t alignment,
                     [[maybe_unused]] size_t offset,
                     [[maybe_unused]] const char* pName,
                     [[maybe_unused]] int flags,
                     [[maybe_unused]] unsigned debugFlags,
                     [[maybe_unused]] const char* file,
                     [[maybe_unused]] int line)
{
    return aligned_alloc(alignment, size);
}

///////////////////////////////////////////////////////////////////////////
void* operator new(size_t size,
                   [[maybe_unused]] const char* name,
                   [[maybe_unused]] int flags,
                   [[maybe_unused]] unsigned debugFlags,
                   [[maybe_unused]] const char* file,
                   [[maybe_unused]] int line)
{
    return malloc(size);
}
```

`compile_flags.txt` is a simple text file that contains the compiler flags passed to `clangd` by neovim.

`memcpy.cpp` will be our first attempt at utilizing Vulkan for image processing, using `memcpy()` calls as noted previously.
Then, we are going to write a zero-copy version in `zero-copy.cpp`. We will compare the performance of `memcpy.cpp` and
`zero-copy.cpp` to see which one is more efficient. There is also `main.cpp`, which will accept a command-line flag to switch
between these two implementations: `./main -memcpy` will invoke the `memcpy()`-based pipeline, while `./main -zero-copy` will
run the **zero-copy** pipeline. Note that you can download this project from the [Github repository](https://github.com/0xdeadf1sh/ZeroCopyVulkan)
like this:

```bash
git clone https://github.com/0xdeadf1sh/ZeroCopyVulkan
```

Now that the project is set up, we can start writing some code.

### Initial scaffolding

Open `memcpy.hpp` and add the following lines:

```cpp
// memcpy.hpp

#pragma once

#include <volk/volk.h>

namespace zcv::memcpy
{
    ///////////////////////////////////////////////////////////////////////////
    ////////////////////////////////// ENTRY //////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    int main();
}
```

Open `memcpy.cpp` and add the following:

```cpp
// memcpy.cpp

#include "memcpy.hpp"

#include <cstdlib>

namespace zcv::memcpy
{
    ///////////////////////////////////////////////////////////////////////////
    ////////////////////////////////// ENTRY //////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    int main()
    {
        return EXIT_SUCCESS;
    }
}
```

Now do the same for `zero-copy.hpp` and `zero-copy.cpp`:

```cpp
// zero-copy.hpp

#pragma once

#include <volk/volk.h>

namespace zcv::zerocopy
{
    ///////////////////////////////////////////////////////////////////////////
    ////////////////////////////////// ENTRY //////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    int main();
}
```

```cpp
// zero-copy.cpp

#include "zero-copy.hpp"

#include <cstdlib>

namespace zcv::zerocopy
{
    ///////////////////////////////////////////////////////////////////////////
    ////////////////////////////////// ENTRY //////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    int main()
    {
        return EXIT_SUCCESS;
    }
}
```

We will put the memcpy and zero-copy implementations in their own respective namespaces, so that their
symbols don't conflict with each other. Both have a `main()` function that acts as an "entry-point".

Now write the code for `main.cpp`:

```cpp
// main.cpp

#include "memcpy.hpp"
#include "zero-copy.hpp"

#include <print>
#include <cstdlib>
#include <cstring>

///////////////////////////////////////////////////////////////////////////
////////////////////////////////// ENTRY //////////////////////////////////
///////////////////////////////////////////////////////////////////////////
int main(int argc, char** argv)
{
    if (argc < 2) {
        std::println("Usage: '{} -memcpy' OR '{} -zero-copy'", argv[0],
                                                               argv[0]);
        return EXIT_SUCCESS;
    }

    if (!strncmp(argv[1], "-memcpy", 7)) {
        return zcv::memcpy::main();
    }
    else if (!strncmp(argv[1], "-zero-copy", 10)) {
        return zcv::zerocopy::main();
    }

    std::println(stderr, "{}: ERROR: '{}' is an unknown option!", argv[0],
                                                                  argv[1]);

    return EXIT_FAILURE;
}
```

Our `main.cpp` is simple---we check whether the user has passed `-memcpy` or `-zero-copy`,
and then initiate the appropriate pipeline. Otherwise, we print an error and exit. Compile and run the
project with:

```bash
cmake -B build -DCMAKE_BUILD_TYPE=Debug .
cmake --build build --parallel
```

For release mode, type the following:

```bash
cmake -B build -DCMAKE_BUILD_TYPE=Release .
cmake --build build --parallel
```

> Note: Our project doesn't need to pass `RelWithDebInfo` to `CMAKE_BUILD_TYPE`, because we already pass the `-g` option
to the compiler in `compile_flags.cmake`.

> Another note: If you don't want to lose your debug build when generating a release build, you can put these
executables in different directories like this:
`cmake -B build/debug -DCMAKE_BUILD_TYPE=Debug` (for debug builds), and,
`cmake -B build/release -DCMAKE_BUILD_TYPE=Release` (for release builds)

This will produce a binary called `ZeroCopyVulkan` in the `build` directory.

Because we have disabled exceptions, we will need another mechanism to percolate the errors from the implementations
to the `main` routine. A simple way to do that is to define an interface called `IValid` that by default represents
a "valid" object, but can be made "invalid" by the class that implements it. Here's its source code:

```cpp
// ivalid.hpp

#pragma once

namespace zcv
{
    ///////////////////////////////////////////////////////////////////////////
    class IValid
    {
    private:
        bool m_isValid          { true                  };

    protected:
        void invalidate()       { m_isValid = false;    }

    public:
        bool isValid() const    { return m_isValid;     }

        virtual ~IValid()       {}
    };

    ///////////////////////////////////////////////////////////////////////////
    #define VALIDATE_OBJECT(OBJECT)                                         \
        if (!(OBJECT).isValid()) {                                          \
            std::println(stderr, #OBJECT " is not valid at file "           \
                                 "'{}', line '{}'", __FILE__, __LINE__);    \
            return EXIT_FAILURE;                                            \
        }

    ///////////////////////////////////////////////////////////////////////////
    #define VALIDATE_FUNCTION(FUNCTION_CALL)                                \
        if (EXIT_SUCCESS != FUNCTION_CALL) {                                \
            std::println(stderr, #FUNCTION_CALL " is not valid at file "    \
                                 "'{}', line '{}'", __FILE__, __LINE__);    \
            invalidate();                                                   \
            return EXIT_FAILURE;                                            \
        }

    ///////////////////////////////////////////////////////////////////////////
    #define VALIDATE_FUNCTION_CTOR(FUNCTION_CALL)                           \
        if (EXIT_SUCCESS != FUNCTION_CALL) {                                \
            std::println(stderr, #FUNCTION_CALL " is not valid at file "    \
                                 "'{}', line '{}'", __FILE__, __LINE__);    \
            invalidate();                                                   \
            return;                                                         \
        }
}
```

The macro `VALIDATE_OBJECT` will be used to check whether the given `IValid` object
is in a valid state. It will print an error message and return immediately if it is not.

The macros `VALIDATE_FUNCTION` and `VALIDATE_FUNCTION_CTOR` will be placed inside the methods
of our `IValid` classes. The `_CTOR` variant is for the constructor, since we can't return
a value from there.

We will also create `util.hpp` to store some commonly used functions and macros:

```cpp
// util.hpp

#pragma once

///////////////////////////////////////////////////////////////////////////
#define BUFFER_LEN(BUFFER) (sizeof(BUFFER) / sizeof((BUFFER)[0]))

namespace zcv
{

}
```

I put `BUFFER_LEN` outside the namespace to make us remember that the preprocessor
doesn't care about namespaces.

### Initializing Vulkan



## memcpy() is fast?
