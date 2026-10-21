#include "graphics.h"
#include "audio.h"
#include "samples.h"
#include "parser.h"
#include "interpreter.h"
#include "visualizer.h"
#include "editor.h"
#include <stdbool.h>
#include <string.h>
#include <stdio.h>

#ifdef __PSP__
#include <pspkernel.h>
#include <pspctrl.h>
#include <psppower.h>

PSP_MODULE_INFO("ShiftPSP", 0, 1, 0);
PSP_MAIN_THREAD_ATTR(THREAD_ATTR_USER | THREAD_ATTR_VFPU);

static int s_running = 1;

static int exit_callback(int arg1, int arg2, void *common) {
    s_running = 0;
    return 0;
}

static int callback_thread(SceSize args, void *argp) {
    int cbid = sceKernelCreateCallback("Exit Callback", exit_callback, NULL);
    sceKernelRegisterExitCallback(cbid);
    sceKernelSleepThreadCB();
    return 0;
}

static int setup_callbacks(void) {
    int thid = sceKernelCreateThread("update_thread", callback_thread, 0x11, 0xFA0, 0, 0);
    if (thid >= 0) sceKernelStartThread(thid, 0, 0);
    return thid;
}
#elif defined(USE_SDL)
#include <SDL.h>
static bool s_running = true;
#endif

int main(int argc, char* argv[]) {
#ifdef __PSP__
    setup_callbacks();
    scePowerSetClockFrequency(333, 333, 166);
    sceCtrlSetSamplingCycle(0);
    sceCtrlSetSamplingMode(PSP_CTRL_MODE_ANALOG);
#elif defined(USE_SDL)
    if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_AUDIO) != 0) {
        printf("SDL_Init Error: %s\n", SDL_GetError());
        return 1;
    }
#endif

    // Initialize systems
    graphics_init();
    audio_init();
    samples_init();
    visualizer_init();
    interpreter_init();
    editor_init(NULL);

    ControllerInput prev_input;
    memset(&prev_input, 0, sizeof(prev_input));

    while (s_running) {
#ifdef __PSP__
        static uint64_t last_time = 0;
        if (last_time == 0) last_time = sceKernelGetSystemTimeWide();
        uint64_t now_time = sceKernelGetSystemTimeWide();
        float dt = (float)(now_time - last_time) / 1000000.0f;
        last_time = now_time;
#elif defined(USE_SDL)
        static Uint32 last_ticks = 0;
        if (last_ticks == 0) last_ticks = SDL_GetTicks();
        Uint32 now_ticks = SDL_GetTicks();
        float dt = (float)(now_ticks - last_ticks) / 1000.0f;
        last_ticks = now_ticks;
#else
        float dt = 1.0f / 60.0f;
#endif
        if (dt > 0.10f) dt = 0.10f;
        if (dt < 0.001f) dt = 0.001f;

        ControllerInput input;
        memset(&input, 0, sizeof(input));

#ifdef __PSP__
        SceCtrlData pad;
        sceCtrlPeekBufferPositive(&pad, 1);

        input.up = (pad.Buttons & PSP_CTRL_UP) != 0;
        input.down = (pad.Buttons & PSP_CTRL_DOWN) != 0;
        input.left = (pad.Buttons & PSP_CTRL_LEFT) != 0;
        input.right = (pad.Buttons & PSP_CTRL_RIGHT) != 0;
        input.triangle = (pad.Buttons & PSP_CTRL_TRIANGLE) != 0;
        input.circle = (pad.Buttons & PSP_CTRL_CIRCLE) != 0;
        input.cross = (pad.Buttons & PSP_CTRL_CROSS) != 0;
        input.square = (pad.Buttons & PSP_CTRL_SQUARE) != 0;
        input.l_trigger = (pad.Buttons & PSP_CTRL_LTRIGGER) != 0;
        input.r_trigger = (pad.Buttons & PSP_CTRL_RTRIGGER) != 0;
        input.start = (pad.Buttons & PSP_CTRL_START) != 0;
        input.select = (pad.Buttons & PSP_CTRL_SELECT) != 0;
#elif defined(USE_SDL)
        SDL_Event ev;
        while (SDL_PollEvent(&ev)) {
            if (ev.type == SDL_QUIT) {
                s_running = false;
            }
        }

        const Uint8* state = SDL_GetKeyboardState(NULL);
        input.up = state[SDL_SCANCODE_UP];
        input.down = state[SDL_SCANCODE_DOWN];
        input.left = state[SDL_SCANCODE_LEFT];
        input.right = state[SDL_SCANCODE_RIGHT];
        // Action buttons: Triangle (W), Circle (D), Cross (S), Square (A)
        input.triangle = state[SDL_SCANCODE_W];
        input.circle = state[SDL_SCANCODE_D];
        input.cross = state[SDL_SCANCODE_S];
        input.square = state[SDL_SCANCODE_A];
        // Line skipping
        input.l_trigger = state[SDL_SCANCODE_Q];
        input.r_trigger = state[SDL_SCANCODE_R];
        // Start & Select
        input.start = state[SDL_SCANCODE_SPACE] || state[SDL_SCANCODE_RETURN];
        input.select = state[SDL_SCANCODE_TAB] || state[SDL_SCANCODE_ESCAPE];
#endif

        // Process controller input
        editor_handle_input(input, prev_input);
        prev_input = input;

        // Step simulation & visualizer
        interpreter_tick(dt);
        visualizer_update(dt);
        editor_update(dt);

        // Render frame
        editor_render();
        graphics_flip();
    }

    audio_shutdown();
    graphics_shutdown();

#ifdef __PSP__
    sceKernelExitGame();
#elif defined(USE_SDL)
    SDL_Quit();
#endif

    return 0;
}
