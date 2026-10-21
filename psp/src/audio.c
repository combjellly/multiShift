#include "audio.h"
#include "samples.h"
#include <math.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>

#ifdef __PSP__
#include <pspkernel.h>
#include <pspaudio.h>
#include <pspaudiolib.h>
#elif defined(USE_SDL)
#include <SDL.h>
#endif

#define PI 3.14159265358979323846f
#define TWO_PI (2.0f * PI)

static SynthVoice s_synth_voices[MAX_SYNTH_VOICES];
static SampleVoice s_sample_voices[MAX_SAMPLE_VOICES];
static SampleData s_samples[MAX_LOADED_SAMPLES];
static int s_sample_count = 0;
static float s_master_peak = 0.0f;

#ifdef __PSP__
static SceUID s_audio_sema = -1;
#elif defined(USE_SDL)
static SDL_AudioDeviceID s_audio_device = 0;
#endif

// Ultra-fast zero-division soft-saturation limiter
static inline float soft_clip(float x) {
    if (x > 1.25f) return 1.0f;
    if (x < -1.25f) return -1.0f;
    // Linear fast path: 90%+ of audio samples are in safe linear range
    if (x > -0.6f && x < 0.6f) return x;
    // Smooth cubic soft knee saturation without any float divisions
    return x * (1.25f - 0.25f * x * x);
}

#ifdef USE_SDL
static void sdl_audio_callback(void* userdata, Uint8* stream, int len) {
    audio_mix_buffer((int16_t*)stream, len / (2 * sizeof(int16_t)));
}
#endif

void audio_init(void) {
    memset(s_synth_voices, 0, sizeof(s_synth_voices));
    memset(s_sample_voices, 0, sizeof(s_sample_voices));
    memset(s_samples, 0, sizeof(s_samples));
    s_sample_count = 0;
    s_master_peak = 0.0f;

#ifdef __PSP__
    if (s_audio_sema < 0) {
        s_audio_sema = sceKernelCreateSema("AudioMutex", 0, 1, 1, NULL);
    }
    pspAudioInit();
    pspAudioSetChannelCallback(0, (void*)audio_mix_buffer, NULL);
#elif defined(USE_SDL)
    SDL_AudioSpec wanted, obtained;
    SDL_zero(wanted);
    wanted.freq = AUDIO_SAMPLE_RATE;
    wanted.format = AUDIO_S16SYS;
    wanted.channels = 2;
    wanted.samples = AUDIO_BUFFER_SIZE;
    wanted.callback = sdl_audio_callback;
    
    s_audio_device = SDL_OpenAudioDevice(NULL, 0, &wanted, &obtained, 0);
    if (s_audio_device != 0) {
        SDL_PauseAudioDevice(s_audio_device, 0);
    }
#endif
}

void audio_shutdown(void) {
#ifdef __PSP__
    pspAudioEnd();
    if (s_audio_sema >= 0) {
        sceKernelDeleteSema(s_audio_sema);
        s_audio_sema = -1;
    }
#elif defined(USE_SDL)
    if (s_audio_device != 0) {
        SDL_CloseAudioDevice(s_audio_device);
        s_audio_device = 0;
    }
#endif
}

void audio_lock(void) {
#ifdef __PSP__
    if (s_audio_sema >= 0) sceKernelWaitSema(s_audio_sema, 1, NULL);
#elif defined(USE_SDL)
    if (s_audio_device != 0) SDL_LockAudioDevice(s_audio_device);
#endif
}

void audio_unlock(void) {
#ifdef __PSP__
    if (s_audio_sema >= 0) sceKernelSignalSema(s_audio_sema, 1);
#elif defined(USE_SDL)
    if (s_audio_device != 0) SDL_UnlockAudioDevice(s_audio_device);
#endif
}

int audio_register_sample(const char* name, int variant, int16_t* pcm, uint32_t length, uint32_t sample_rate) {
    audio_lock();
    if (s_sample_count >= MAX_LOADED_SAMPLES) {
        audio_unlock();
        return -1;
    }
    int idx = s_sample_count++;
    strncpy(s_samples[idx].name, name, sizeof(s_samples[idx].name) - 1);
    s_samples[idx].name[sizeof(s_samples[idx].name) - 1] = '\0';
    s_samples[idx].variant = variant;
    s_samples[idx].pcm_data = pcm;
    s_samples[idx].length = length;
    s_samples[idx].sample_rate = sample_rate;
    audio_unlock();
    return idx;
}

bool audio_is_sample_loaded(const char* name) {
    if (!name || name[0] == '\0') return false;
    for (int i = 0; i < s_sample_count; i++) {
        if (strcasecmp(s_samples[i].name, name) == 0) {
            return true;
        }
    }
    return false;
}

int audio_count_sample_variants(const char* name) {
    int count = 0;
    for (int i = 0; i < s_sample_count; i++) {
        if (strcasecmp(s_samples[i].name, name) == 0 && s_samples[i].variant >= 0) {
            count++;
        }
    }
    if (count == 0) {
        for (int i = 0; i < s_sample_count; i++) {
            if (strcasecmp(s_samples[i].name, name) == 0) return 1;
        }
    }
    return count;
}

int audio_find_sample_variant(const char* name, int variant) {
    if (!name || name[0] == '\0') return -1;

    // Check if loaded; if not, attempt on-demand load
    if (!audio_is_sample_loaded(name)) {
        samples_ensure_loaded(name);
    }

    int real_matches[128];
    int real_count = 0;
    int fallback_idx = -1;

    for (int i = 0; i < s_sample_count; i++) {
        if (strcasecmp(s_samples[i].name, name) == 0) {
            if (s_samples[i].variant == variant && variant >= 0) {
                return i; // exact variant match
            }
            if (s_samples[i].variant >= 0) {
                if (real_count < 128) real_matches[real_count++] = i;
            } else {
                fallback_idx = i;
            }
        }
    }

    if (real_count > 0) {
        if (variant < 0) variant = 0;
        return real_matches[variant % real_count];
    }

    return fallback_idx;
}

int audio_find_sample(const char* name) {
    return audio_find_sample_variant(name, 0);
}

SampleData* audio_get_sample(int index) {
    if (index >= 0 && index < s_sample_count) {
        return &s_samples[index];
    }
    return NULL;
}

int audio_get_sample_count(void) {
    return s_sample_count;
}

void audio_trigger_synth(int loop_id, float note, float gain, float duration, OscType type) {
    audio_lock();

    // 1. Try to find existing voice for this loop_id to smoothly transition/retrigger
    int voice_idx = -1;
    for (int i = 0; i < MAX_SYNTH_VOICES; i++) {
        if (s_synth_voices[i].active && s_synth_voices[i].loop_id == loop_id) {
            voice_idx = i;
            break;
        }
    }

    // 2. If no voice with loop_id, find inactive voice
    if (voice_idx == -1) {
        for (int i = 0; i < MAX_SYNTH_VOICES; i++) {
            if (!s_synth_voices[i].active) {
                voice_idx = i;
                break;
            }
        }
    }

    // 3. Fallback: steal oldest voice
    if (voice_idx == -1) {
        voice_idx = 0;
        float max_elapsed = s_synth_voices[0].elapsed;
        for (int i = 1; i < MAX_SYNTH_VOICES; i++) {
            if (s_synth_voices[i].elapsed > max_elapsed) {
                max_elapsed = s_synth_voices[i].elapsed;
                voice_idx = i;
            }
        }
    }

    SynthVoice* v = &s_synth_voices[voice_idx];
    v->active = true;
    v->loop_id = loop_id;
    v->type = type;
    // MIDI note to frequency: 440 * 2^((note - 69)/12)
    v->freq = 440.0f * powf(2.0f, (note - 69.0f) / 12.0f);
    v->target_gain = (gain > 1.2f) ? 1.2f : ((gain < 0.0f) ? 0.0f : gain);
    v->current_gain = 0.001f;
    v->attack = 0.008f;
    v->duration = (duration > 0.05f) ? duration : 0.45f;
    v->release = (v->duration * 0.25f > 0.08f) ? 0.08f : (v->duration * 0.25f);
    v->elapsed = 0.0f;
    v->filter_cutoff = 0.75f;
    v->filter_state = 0.0f;

    audio_unlock();
}

void audio_trigger_sample(int loop_id, int sample_index, float note, float gain, float pan, int cut_group) {
    if (sample_index < 0 || sample_index >= s_sample_count) return;
    if (!s_samples[sample_index].pcm_data || s_samples[sample_index].length == 0) return;

    audio_lock();

    // 1. Choke any active voices in the same cut group (if cut_group != 0)
    if (cut_group != 0) {
        for (int i = 0; i < MAX_SAMPLE_VOICES; i++) {
            SampleVoice* v = &s_sample_voices[i];
            if (!v->active || v->fading_out) continue;

            bool should_choke = false;
            if (cut_group > 0 && v->cut_group == cut_group) {
                should_choke = true;
            } else if (cut_group < 0 && v->cut_group == cut_group) {
                // If cut_group < 0, only choke if it's the exact same sample
                if (strcasecmp(s_samples[v->sample_index].name, s_samples[sample_index].name) == 0) {
                    should_choke = true;
                }
            }

            if (should_choke) {
                v->fading_out = true;
                v->cut_group = 0; // Detach from cut group
            }
        }
    }

    // 2. Find voice channel (prefer inactive, then fading out, then oldest)
    int voice_idx = -1;
    for (int i = 0; i < MAX_SAMPLE_VOICES; i++) {
        if (!s_sample_voices[i].active) {
            voice_idx = i;
            break;
        }
    }

    if (voice_idx == -1) {
        for (int i = 0; i < MAX_SAMPLE_VOICES; i++) {
            if (s_sample_voices[i].fading_out) {
                voice_idx = i;
                break;
            }
        }
    }

    if (voice_idx == -1) {
        voice_idx = 0;
        float max_elapsed = s_sample_voices[0].elapsed;
        for (int i = 1; i < MAX_SAMPLE_VOICES; i++) {
            if (s_sample_voices[i].elapsed > max_elapsed) {
                max_elapsed = s_sample_voices[i].elapsed;
                voice_idx = i;
            }
        }
    }

    SampleVoice* sv = &s_sample_voices[voice_idx];
    sv->active = true;
    sv->loop_id = loop_id;
    sv->sample_index = sample_index;
    sv->cut_group = cut_group;
    sv->playhead = 0.0f;
    // Semitone pitch shift relative to 0 (or relative to 60 if standard MIDI note)
    float semitones = note;
    if (semitones > 36.0f) semitones -= 60.0f;
    float rate_factor = 1.0f;
    if (s_samples[sample_index].sample_rate > 0) {
        rate_factor = (float)s_samples[sample_index].sample_rate / (float)AUDIO_SAMPLE_RATE;
    }
    sv->playback_rate = powf(2.0f, semitones / 12.0f) * rate_factor;
    sv->gain = (gain > 1.5f) ? 1.5f : ((gain < 0.0f) ? 0.0f : gain);
    // Pan normalized: 0.0 (left) to 1.0 (right), 50.0 is center
    float norm_pan = (pan >= 0.0f && pan <= 100.0f) ? (pan / 100.0f) : 0.5f;
    sv->pan = norm_pan;
    sv->elapsed = 0.0f;
    sv->fading_out = false;
    sv->fade_gain = 1.0f;

    // Precalculate stereo panning gains and fold 1/32768 into gain
    // This eliminates millions of expensive sinf/cosf and float divisions in 44.1kHz inner loop
    float pan_l = cosf(norm_pan * 1.57079632679f);
    float pan_r = sinf(norm_pan * 1.57079632679f);
    const float INV_PCM16 = 1.0f / 32768.0f;
    sv->gain_l = (pan_l * sv->gain * 0.35f) * INV_PCM16;
    sv->gain_r = (pan_r * sv->gain * 0.35f) * INV_PCM16;

    audio_unlock();
}

void audio_mix_buffer(int16_t* output_buffer, unsigned int frames) {
    audio_lock();

    float dt = 1.0f / (float)AUDIO_SAMPLE_RATE;
    float peak_tracker = 0.0f;

    for (unsigned int f = 0; f < frames; f++) {
        float mix_l = 0.0f;
        float mix_r = 0.0f;

        // 1. Process Synth Voices
        for (int i = 0; i < MAX_SYNTH_VOICES; i++) {
            SynthVoice* v = &s_synth_voices[i];
            if (!v->active) continue;

            // Envelope calculation
            if (v->elapsed < v->attack) {
                v->current_gain += (v->target_gain / v->attack) * dt;
            } else if (v->elapsed >= v->duration - v->release) {
                float release_remaining = v->duration - v->elapsed;
                if (release_remaining <= 0.001f) {
                    v->active = false;
                    continue;
                }
                v->current_gain -= (v->target_gain / v->release) * dt;
                if (v->current_gain < 0.0f) v->current_gain = 0.0f;
            }

            // Generate oscillator waveform
            float osc_val = 0.0f;
            float norm_phase = v->phase / TWO_PI;
            norm_phase -= floorf(norm_phase);

            switch (v->type) {
                case OSC_SINE:
                    osc_val = sinf(v->phase);
                    break;
                case OSC_SAW:
                    osc_val = 2.0f * (norm_phase - 0.5f);
                    break;
                case OSC_SQUARE:
                    osc_val = (norm_phase < 0.5f) ? 0.85f : -0.85f;
                    break;
                case OSC_TRIANGLE:
                    osc_val = 2.0f * fabsf(2.0f * (norm_phase - 0.5f)) - 1.0f;
                    break;
            }

            // One-pole lowpass filter for warmth and anti-aliasing
            v->filter_state += v->filter_cutoff * (osc_val - v->filter_state);
            float voice_out = v->filter_state * v->current_gain * 0.35f;

            mix_l += voice_out;
            mix_r += voice_out;

            // Advance phase & time
            v->phase += TWO_PI * v->freq * dt;
            if (v->phase >= TWO_PI) v->phase -= TWO_PI;
            v->elapsed += dt;

            if (v->elapsed >= v->duration) {
                v->active = false;
            }
        }

        // 2. Process Sample Voices (True Polyphony - Fast Inner Loop)
        for (int i = 0; i < MAX_SAMPLE_VOICES; i++) {
            SampleVoice* sv = &s_sample_voices[i];
            if (!sv->active) continue;

            SampleData* sample = &s_samples[sv->sample_index];
            uint32_t idx_int = (uint32_t)sv->playhead;

            // Natural end of sample waveform
            if (idx_int >= sample->length - 1) {
                sv->active = false;
                continue;
            }

            // Smooth 5ms micro-fade on cut/choke to prevent pops/clicks
            if (sv->fading_out) {
                sv->fade_gain -= dt * 200.0f;
                if (sv->fade_gain <= 0.0f) {
                    sv->active = false;
                    continue;
                }
            } else if (sv->elapsed > 5.0f) {
                // Natural decay for long cymbals / tails to free voices
                sv->fading_out = true;
            }

            // Linear interpolation without division in inner loop
            float frac = sv->playhead - (float)idx_int;
            int16_t s0 = sample->pcm_data[idx_int];
            int16_t s1 = sample->pcm_data[idx_int + 1];
            float interp = (float)s0 + frac * (float)(s1 - s0);

            float voice_out = interp * sv->fade_gain;
            mix_l += voice_out * sv->gain_l;
            mix_r += voice_out * sv->gain_r;

            sv->playhead += sv->playback_rate;
            sv->elapsed += dt;
        }

        // 3. Master Soft-Limiter Saturation
        mix_l = soft_clip(mix_l * 0.85f);
        mix_r = soft_clip(mix_r * 0.85f);

        float cur_mag = fabsf(mix_l);
        if (cur_mag > peak_tracker) peak_tracker = cur_mag;

        // Convert to 16-bit signed PCM
        output_buffer[f * 2 + 0] = (int16_t)(mix_l * 32767.0f);
        output_buffer[f * 2 + 1] = (int16_t)(mix_r * 32767.0f);
    }

    s_master_peak = s_master_peak * 0.85f + peak_tracker * 0.15f;

    audio_unlock();
}

float audio_get_master_volume(void) {
    return s_master_peak;
}
