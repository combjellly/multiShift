#include "samples.h"
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <math.h>
#include <stdio.h>
#include <dirent.h>
#include <sys/stat.h>

#define MAX_CATALOG_SAMPLES 256
static char s_catalog[MAX_CATALOG_SAMPLES][32];
static int s_catalog_count = 0;

static const char* S_SAMPLE_ROOTS[] = {
    "samples",
    "./samples",
    "../samples",
    "../shift/samples",
    "/Users/nico/Documents/shift/samples",
    "psp/samples",
    "ms0:/PSP/GAME/shift/samples",
    "ms0:/PSP/GAME/SHIFT/samples",
    NULL
};

// Robust RIFF chunk-based WAV loader supporting 8, 16, 24, 32-bit PCM and 32-bit float
static int16_t* load_wav_file(const char* filepath, uint32_t* out_len, uint32_t* out_rate) {
    FILE* f = fopen(filepath, "rb");
    if (!f) return NULL;

    char riff_head[12];
    if (fread(riff_head, 1, 12, f) != 12) {
        fclose(f);
        return NULL;
    }

    if (memcmp(riff_head, "RIFF", 4) != 0 || memcmp(riff_head + 8, "WAVE", 4) != 0) {
        fclose(f);
        return NULL;
    }

    uint16_t format_tag = 0;
    uint16_t channels = 0;
    uint32_t sample_rate = 44100;
    uint16_t bits_per_sample = 16;
    uint32_t data_size = 0;
    long data_pos = 0;

    // Scan chunks
    while (1) {
        char chunk_id[4];
        uint32_t chunk_size = 0;
        if (fread(chunk_id, 1, 4, f) != 4) break;
        if (fread(&chunk_size, 4, 1, f) != 1) break;

        if (memcmp(chunk_id, "fmt ", 4) == 0) {
            uint8_t fmt_buf[40];
            uint32_t to_read = chunk_size < sizeof(fmt_buf) ? chunk_size : (uint32_t)sizeof(fmt_buf);
            if (fread(fmt_buf, 1, to_read, f) != to_read) break;
            if (to_read >= 16) {
                format_tag = *(uint16_t*)(fmt_buf + 0);
                channels = *(uint16_t*)(fmt_buf + 2);
                sample_rate = *(uint32_t*)(fmt_buf + 4);
                bits_per_sample = *(uint16_t*)(fmt_buf + 14);
            }
            if (chunk_size > to_read) {
                fseek(f, chunk_size - to_read, SEEK_CUR);
            }
        } else if (memcmp(chunk_id, "data", 4) == 0) {
            data_size = chunk_size;
            data_pos = ftell(f);
            fseek(f, chunk_size, SEEK_CUR);
        } else {
            fseek(f, chunk_size, SEEK_CUR);
        }

        if (chunk_size & 1) {
            fseek(f, 1, SEEK_CUR);
        }
    }

    if (data_pos == 0 || data_size == 0 || channels == 0) {
        fclose(f);
        return NULL;
    }

    if (format_tag != 1 && format_tag != 3) {
        fclose(f);
        return NULL;
    }

    fseek(f, data_pos, SEEK_SET);

    uint32_t bytes_per_sample = bits_per_sample / 8;
    if (bytes_per_sample == 0) bytes_per_sample = 2;
    uint32_t total_frames = data_size / (channels * bytes_per_sample);
    if (total_frames == 0) {
        fclose(f);
        return NULL;
    }

    // Limit individual sample to max 15 seconds to allow full cymbal, guitar, and pad decay
    uint32_t max_allowed_frames = sample_rate * 15;
    if (total_frames > max_allowed_frames) {
        total_frames = max_allowed_frames;
        data_size = total_frames * channels * bytes_per_sample;
    }

    int16_t* pcm = (int16_t*)malloc(total_frames * sizeof(int16_t));
    if (!pcm) {
        fclose(f);
        return NULL;
    }

    uint8_t* raw_buf = (uint8_t*)malloc(data_size);
    if (!raw_buf) {
        free(pcm);
        fclose(f);
        return NULL;
    }

    size_t bytes_read = fread(raw_buf, 1, data_size, f);
    fclose(f);
    if (bytes_read < data_size) {
        total_frames = (uint32_t)(bytes_read / (channels * bytes_per_sample));
    }

    for (uint32_t i = 0; i < total_frames; i++) {
        float sum = 0.0f;
        for (int ch = 0; ch < channels; ch++) {
            uint32_t offset = (i * channels + ch) * bytes_per_sample;
            if (offset + bytes_per_sample > bytes_read) break;

            float sample_val = 0.0f;
            if (format_tag == 1) {
                if (bits_per_sample == 8) {
                    sample_val = ((float)raw_buf[offset] - 128.0f) / 128.0f;
                } else if (bits_per_sample == 16) {
                    int16_t val = (int16_t)(raw_buf[offset] | (raw_buf[offset + 1] << 8));
                    sample_val = (float)val / 32768.0f;
                } else if (bits_per_sample == 24) {
                    int32_t val = (int32_t)((raw_buf[offset] << 8) | (raw_buf[offset + 1] << 16) | (raw_buf[offset + 2] << 24));
                    sample_val = (float)val / 2147483648.0f;
                } else if (bits_per_sample == 32) {
                    int32_t val = (int32_t)(raw_buf[offset] | (raw_buf[offset + 1] << 8) | (raw_buf[offset + 2] << 16) | (raw_buf[offset + 3] << 24));
                    sample_val = (float)val / 2147483648.0f;
                }
            } else if (format_tag == 3 && bits_per_sample == 32) {
                sample_val = *(float*)(raw_buf + offset);
            }
            sum += sample_val;
        }

        float mono_sample = sum / (float)channels;
        if (mono_sample > 1.0f) mono_sample = 1.0f;
        if (mono_sample < -1.0f) mono_sample = -1.0f;
        pcm[i] = (int16_t)(mono_sample * 32767.0f);
    }

    // Micro fade-out over last 64 samples to eliminate DC offset / EOF clicks
    if (total_frames > 64) {
        for (uint32_t f_idx = 0; f_idx < 64; f_idx++) {
            uint32_t idx = total_frames - 64 + f_idx;
            float fade = (float)(63 - f_idx) / 63.0f;
            pcm[idx] = (int16_t)(pcm[idx] * fade);
        }
    }

    free(raw_buf);
    *out_len = total_frames;
    *out_rate = sample_rate;
    return pcm;
}

static void catalog_add(const char* name) {
    if (!name || name[0] == '\0') return;
    char lower[32];
    strncpy(lower, name, sizeof(lower) - 1);
    lower[sizeof(lower) - 1] = '\0';
    for (int i = 0; lower[i]; i++) {
        lower[i] = tolower((unsigned char)lower[i]);
    }

    // Check if already in catalog
    for (int i = 0; i < s_catalog_count; i++) {
        if (strcmp(s_catalog[i], lower) == 0) return;
    }

    if (s_catalog_count < MAX_CATALOG_SAMPLES) {
        strncpy(s_catalog[s_catalog_count++], lower, sizeof(s_catalog[0]) - 1);
    }
}

static int catalog_sort_cmp(const void* a, const void* b) {
    return strcmp((const char*)a, (const char*)b);
}

void samples_init(void) {
    s_catalog_count = 0;

    // Scan sample directories to build the available sample catalog (lightweight, NO audio loading)
    for (int r = 0; S_SAMPLE_ROOTS[r] != NULL; r++) {
        const char* root = S_SAMPLE_ROOTS[r];
        DIR* dir = opendir(root);
        if (!dir) continue;

        struct dirent* entry;
        while ((entry = readdir(dir)) != NULL) {
            if (entry->d_name[0] == '.') continue;

            char full_path[512];
            snprintf(full_path, sizeof(full_path), "%s/%s", root, entry->d_name);

            struct stat st;
            if (stat(full_path, &st) != 0) continue;

            if (S_ISDIR(st.st_mode)) {
                catalog_add(entry->d_name);
            } else if (S_ISREG(st.st_mode)) {
                int nlen = (int)strlen(entry->d_name);
                if (nlen > 4 && strcasecmp(entry->d_name + nlen - 4, ".wav") == 0) {
                    char sname[32];
                    strncpy(sname, entry->d_name, sizeof(sname) - 1);
                    sname[sizeof(sname) - 1] = '\0';
                    if (nlen - 4 < (int)sizeof(sname)) sname[nlen - 4] = '\0';
                    catalog_add(sname);
                }
            }
        }
        closedir(dir);
    }

    if (s_catalog_count > 1) {
        qsort(s_catalog, s_catalog_count, sizeof(s_catalog[0]), catalog_sort_cmp);
    }

    printf("[Samples] Catalog populated: %d sample types discovered (0 in RAM)\n", s_catalog_count);
}

int samples_get_catalog_count(void) {
    return s_catalog_count;
}

const char* samples_get_catalog_name(int idx) {
    if (idx >= 0 && idx < s_catalog_count) {
        return s_catalog[idx];
    }
    return NULL;
}

static bool load_variant_folder(const char* full_path, const char* sample_name) {
    DIR* sub_dir = opendir(full_path);
    if (!sub_dir) return false;

    char sub_files[128][64];
    int sub_count = 0;

    struct dirent* sub_entry;
    while ((sub_entry = readdir(sub_dir)) != NULL && sub_count < 128) {
        if (sub_entry->d_name[0] == '.') continue;
        int nlen = (int)strlen(sub_entry->d_name);
        if (nlen < 5) continue;
        if (strcasecmp(sub_entry->d_name + nlen - 4, ".wav") != 0) continue;

        strncpy(sub_files[sub_count], sub_entry->d_name, sizeof(sub_files[0]) - 1);
        sub_files[sub_count][sizeof(sub_files[0]) - 1] = '\0';
        sub_count++;
    }
    closedir(sub_dir);

    if (sub_count == 0) return false;

    if (sub_count > 1) {
        qsort(sub_files, sub_count, sizeof(sub_files[0]), (int (*)(const void*, const void*))strcmp);
    }

    int loaded = 0;
    for (int v = 0; v < sub_count; v++) {
        char wav_path[1024];
        snprintf(wav_path, sizeof(wav_path), "%s/%s", full_path, sub_files[v]);

        int var_idx = v;
        int parsed_var = -1;
        if (sscanf(sub_files[v], "%d", &parsed_var) == 1 && parsed_var >= 0) {
            var_idx = parsed_var;
        }

        uint32_t len = 0, rate = 0;
        int16_t* pcm = load_wav_file(wav_path, &len, &rate);
        if (pcm) {
            audio_register_sample(sample_name, var_idx, pcm, len, rate);
            loaded++;
        }
    }

    if (loaded > 0) {
        printf("[On-Demand RAM] Loaded %s: %d variants\n", sample_name, loaded);
        return true;
    }
    return false;
}

static bool load_single_wav(const char* full_path, const char* sample_name) {
    uint32_t len = 0, rate = 0;
    int16_t* pcm = load_wav_file(full_path, &len, &rate);
    if (pcm) {
        audio_register_sample(sample_name, -1, pcm, len, rate);
        printf("[On-Demand RAM] Loaded %s (single WAV)\n", sample_name);
        return true;
    }
    return false;
}

bool samples_ensure_loaded(const char* name) {
    if (!name || name[0] == '\0') return false;
    if (strcasecmp(name, "synth") == 0) return true; // synth is procedural oscillator

    // Check if already in RAM
    if (audio_is_sample_loaded(name)) {
        return true;
    }

    char lower_name[32];
    strncpy(lower_name, name, sizeof(lower_name) - 1);
    lower_name[sizeof(lower_name) - 1] = '\0';
    for (int i = 0; lower_name[i]; i++) {
        lower_name[i] = tolower((unsigned char)lower_name[i]);
    }

    // Search in known roots
    for (int r = 0; S_SAMPLE_ROOTS[r] != NULL; r++) {
        const char* root = S_SAMPLE_ROOTS[r];

        // 1. Check directory with exact lower_name
        char path[512];
        snprintf(path, sizeof(path), "%s/%s", root, lower_name);
        struct stat st;
        if (stat(path, &st) == 0 && S_ISDIR(st.st_mode)) {
            if (load_variant_folder(path, lower_name)) return true;
        }

        // 2. Check standalone .wav
        snprintf(path, sizeof(path), "%s/%s.wav", root, lower_name);
        if (stat(path, &st) == 0 && S_ISREG(st.st_mode)) {
            if (load_single_wav(path, lower_name)) return true;
        }

        // 3. Scan directory for case-insensitive folder match
        DIR* d = opendir(root);
        if (d) {
            struct dirent* ent;
            while ((ent = readdir(d)) != NULL) {
                if (ent->d_name[0] == '.') continue;
                if (strcasecmp(ent->d_name, lower_name) == 0) {
                    snprintf(path, sizeof(path), "%s/%s", root, ent->d_name);
                    if (stat(path, &st) == 0 && S_ISDIR(st.st_mode)) {
                        bool ok = load_variant_folder(path, lower_name);
                        closedir(d);
                        if (ok) return true;
                        d = NULL;
                        break;
                    }
                }
            }
            if (d) closedir(d);
        }
    }

    return false;
}

void samples_load_for_program(const Program* prog) {
    if (!prog) return;

    // Scan all loops for play actions
    for (int i = 0; i < prog->loop_count; i++) {
        const Loop* loop = &prog->loops[i];
        for (int a = 0; a < loop->action_count; a++) {
            const Action* act = &loop->actions[a];
            if (act->type == ACTION_PLAY_SAMPLE && act->target[0] != '\0') {
                samples_ensure_loaded(act->target);
            }
        }
    }

    // Scan all tokens for any sample identifiers
    for (int t = 0; t < prog->token_count; t++) {
        if (prog->tokens[t].type == TOK_SAMPLE && prog->tokens[t].text[0] != '\0') {
            samples_ensure_loaded(prog->tokens[t].text);
        }
    }
}
