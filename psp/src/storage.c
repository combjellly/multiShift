#include "storage.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <sys/stat.h>
#include <dirent.h>

#ifdef __PSP__
#include <pspkernel.h>
static const char* S_SEARCH_PATHS[] = {
    "ms0:/PSP/GAME/shift/programs",
    "ms0:/PSP/GAME/SHIFT/programs",
    "ms0:/PSP/GAME/shift",
    "ms0:/PSP/GAME/SHIFT",
    "programs",
    ".",
    NULL
};
#else
static const char* S_SEARCH_PATHS[] = {
    "programs",
    ".",
    NULL
};
#endif

static void ensure_dir_exists(const char* dirpath) {
    struct stat st;
    if (stat(dirpath, &st) != 0) {
#ifdef __PSP__
        sceIoMkdir(dirpath, 0777);
#else
        mkdir(dirpath, 0777);
#endif
    }
}

void storage_init(void) {
    ensure_dir_exists("programs");
#ifdef __PSP__
    ensure_dir_exists("ms0:/PSP/GAME/shift/programs");
    ensure_dir_exists("ms0:/PSP/GAME/SHIFT/programs");
#endif
}

static FILE* open_file_for_write(const char* filename, char* resolved_path, size_t resolved_len) {
    // Try programs directory first
    char path[256];
    snprintf(path, sizeof(path), "programs/%s", filename);
    FILE* f = fopen(path, "w");
    if (!f) {
        // Fallback to direct path
        snprintf(path, sizeof(path), "%s", filename);
        f = fopen(path, "w");
    }
#ifdef __PSP__
    if (!f) {
        snprintf(path, sizeof(path), "ms0:/PSP/GAME/shift/programs/%s", filename);
        f = fopen(path, "w");
    }
    if (!f) {
        snprintf(path, sizeof(path), "ms0:/PSP/GAME/shift/%s", filename);
        f = fopen(path, "w");
    }
#endif
    if (f && resolved_path && resolved_len > 0) {
        snprintf(resolved_path, resolved_len, "%s", path);
    }
    return f;
}

static FILE* open_file_for_read(const char* filename, char* resolved_path, size_t resolved_len) {
    char path[256];
    for (int i = 0; S_SEARCH_PATHS[i] != NULL; i++) {
        snprintf(path, sizeof(path), "%s/%s", S_SEARCH_PATHS[i], filename);
        FILE* f = fopen(path, "r");
        if (f) {
            if (resolved_path && resolved_len > 0) {
                snprintf(resolved_path, resolved_len, "%s", path);
            }
            return f;
        }
    }
    // Also try direct filename
    FILE* f = fopen(filename, "r");
    if (f) {
        if (resolved_path && resolved_len > 0) {
            snprintf(resolved_path, resolved_len, "%s", filename);
        }
        return f;
    }
    return NULL;
}

bool storage_save_file(const char* filename, const char* code) {
    if (!filename || !code) return false;
    storage_init();

    char resolved[256] = "";
    FILE* f = open_file_for_write(filename, resolved, sizeof(resolved));
    if (!f) return false;

    size_t len = strlen(code);
    size_t written = fwrite(code, 1, len, f);
    fclose(f);

    printf("[Storage] Saved %zu bytes to %s\n", written, resolved);
    return (written == len);
}

bool storage_load_file(const char* filename, char* out_code, size_t max_len) {
    if (!filename || !out_code || max_len == 0) return false;

    char resolved[256] = "";
    FILE* f = open_file_for_read(filename, resolved, sizeof(resolved));
    if (!f) return false;

    size_t read_bytes = fread(out_code, 1, max_len - 1, f);
    out_code[read_bytes] = '\0';
    fclose(f);

    printf("[Storage] Loaded %zu bytes from %s\n", read_bytes, resolved);
    return true;
}

bool storage_save_last(const char* code) {
    // Save to both last_saved.txt and direct path for robustness
    bool ok = storage_save_file("last_saved.txt", code);
    return ok;
}

bool storage_load_last(char* out_code, size_t max_len) {
    return storage_load_file("last_saved.txt", out_code, max_len);
}

int storage_list_files(char file_list[MAX_SAVED_FILES][MAX_FILENAME_LEN]) {
    int count = 0;

    // Check if last_saved.txt exists and put it first
    char dummy[16];
    if (storage_load_file("last_saved.txt", dummy, sizeof(dummy))) {
        strncpy(file_list[count++], "last_saved.txt", MAX_FILENAME_LEN - 1);
    }

    for (int i = 0; S_SEARCH_PATHS[i] != NULL && count < MAX_SAVED_FILES; i++) {
        DIR* d = opendir(S_SEARCH_PATHS[i]);
        if (!d) continue;

        struct dirent* ent;
        while ((ent = readdir(d)) != NULL && count < MAX_SAVED_FILES) {
            if (ent->d_name[0] == '.') continue;
            size_t nlen = strlen(ent->d_name);
            if (nlen < 5) continue;

            // Check .txt extension
            if (strcasecmp(ent->d_name + nlen - 4, ".txt") == 0) {
                if (strcmp(ent->d_name, "last_saved.txt") == 0) continue; // already at top

                // Check duplicate
                bool dup = false;
                for (int k = 0; k < count; k++) {
                    if (strcmp(file_list[k], ent->d_name) == 0) {
                        dup = true;
                        break;
                    }
                }
                if (!dup) {
                    strncpy(file_list[count], ent->d_name, MAX_FILENAME_LEN - 1);
                    file_list[count][MAX_FILENAME_LEN - 1] = '\0';
                    count++;
                }
            }
        }
        closedir(d);
    }

    return count;
}

void storage_get_next_slot_name(char* out_name, size_t max_len) {
    char files[MAX_SAVED_FILES][MAX_FILENAME_LEN];
    int count = storage_list_files(files);

    for (int slot = 1; slot <= 99; slot++) {
        char candidate[32];
        snprintf(candidate, sizeof(candidate), "program_%d.txt", slot);
        bool found = false;
        for (int i = 0; i < count; i++) {
            if (strcmp(files[i], candidate) == 0) {
                found = true;
                break;
            }
        }
        if (!found) {
            strncpy(out_name, candidate, max_len - 1);
            out_name[max_len - 1] = '\0';
            return;
        }
    }
    snprintf(out_name, max_len, "program_custom.txt");
}
