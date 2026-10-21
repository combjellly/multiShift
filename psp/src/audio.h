#ifndef SHIFT_AUDIO_H
#define SHIFT_AUDIO_H

#include <stdint.h>
#include <stdbool.h>

#define AUDIO_SAMPLE_RATE 44100
#define AUDIO_BUFFER_SIZE 512
#define MAX_SYNTH_VOICES 16
#define MAX_SAMPLE_VOICES 32
#define MAX_LOADED_SAMPLES 512

typedef enum {
    OSC_SINE = 0,
    OSC_SAW,
    OSC_SQUARE,
    OSC_TRIANGLE
} OscType;

typedef struct {
    bool active;
    int loop_id;
    OscType type;
    float freq;
    float phase;
    float gain;
    float current_gain;
    float target_gain;
    float attack;
    float release;
    float duration;
    float elapsed;
    // Simple filter
    float filter_cutoff;
    float filter_state;
} SynthVoice;

typedef struct {
    char name[32];
    int variant; // -1 for default/single, or 0, 1, 2... for sample variants
    int16_t* pcm_data;
    uint32_t length; // in samples
    uint32_t sample_rate;
} SampleData;

typedef struct {
    bool active;
    int loop_id;
    int sample_index;
    int cut_group; // 0 = never cut (polyphonic), >0 = choke group, <0 = choke same sample
    float playhead; // fractional index for pitch shifting
    float playback_rate;
    float gain;
    float pan; // 0.0 (left) to 1.0 (right), 0.5 center
    float gain_l; // Precomputed left gain (pan, master headroom, 1/32768)
    float gain_r; // Precomputed right gain (pan, master headroom, 1/32768)
    float elapsed;
    bool fading_out;
    float fade_gain;
} SampleVoice;

// Audio System API
void audio_init(void);
void audio_shutdown(void);
void audio_lock(void);
void audio_unlock(void);

// Triggers
void audio_trigger_synth(int loop_id, float note, float gain, float duration, OscType type);
void audio_trigger_sample(int loop_id, int sample_index, float note, float gain, float pan, int cut_group);

// Sample registration & querying
int audio_register_sample(const char* name, int variant, int16_t* pcm, uint32_t length, uint32_t sample_rate);
bool audio_is_sample_loaded(const char* name);
int audio_find_sample(const char* name);
int audio_find_sample_variant(const char* name, int variant);
int audio_count_sample_variants(const char* name);
SampleData* audio_get_sample(int index);
int audio_get_sample_count(void);

// Callback generator for PSP / SDL
void audio_mix_buffer(int16_t* output_buffer, unsigned int frames);

// Peak volume query for visualizer
float audio_get_master_volume(void);

#endif // SHIFT_AUDIO_H
