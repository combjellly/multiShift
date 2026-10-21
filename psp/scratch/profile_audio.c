#include <stdio.h>
#define SDL_MAIN_HANDLED
#include <SDL.h>
#include "samples.h"
#include "parser.h"
#include "interpreter.h"
#include "presets.h"
#include "audio.h"

int main(int argc, char* argv[]) {
    SDL_SetMainReady();
    audio_init();
    samples_init();

    Program prog0;
    parser_parse(S_DEMO_PRESETS[0], &prog0); // Slowcore
    samples_load_for_program(&prog0);

    interpreter_init();
    interpreter_set_program(&prog0);

    printf("=== Profiling Slowcore (Preset 0) ===\n");
    int16_t buffer[AUDIO_BUFFER_SIZE * 2];
    
    Uint32 t0 = SDL_GetTicks();
    int clipped_samples = 0;
    int total_samples = 0;
    float max_sample_val = 0.0f;

    for (int b = 0; b < 258; b++) {
        interpreter_tick(512.0f / 44100.0f);
        audio_mix_buffer(buffer, AUDIO_BUFFER_SIZE);

        for (int i = 0; i < AUDIO_BUFFER_SIZE * 2; i++) {
            total_samples++;
            if (buffer[i] >= 32766 || buffer[i] <= -32766) {
                clipped_samples++;
            }
        }
    }
    Uint32 t1 = SDL_GetTicks();

    printf("Simulated 3 seconds of Slowcore in %u ms.\n", (unsigned int)(t1 - t0));
    printf("Clipped samples: %d / %d (%.2f%%)\n", clipped_samples, total_samples, 
           (float)clipped_samples * 100.0f / (float)total_samples);

    return 0;
}
