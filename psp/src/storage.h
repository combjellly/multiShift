#ifndef SHIFT_STORAGE_H
#define SHIFT_STORAGE_H

#include <stdbool.h>
#include <stddef.h>

#define MAX_SAVED_FILES 64
#define MAX_FILENAME_LEN 64

// Initialize storage subsystem (creates programs directory if needed)
void storage_init(void);

// Save program code to last_saved.txt (and return success)
bool storage_save_last(const char* code);

// Load last saved program code if it exists. Returns true if loaded, false if none.
bool storage_load_last(char* out_code, size_t max_len);

// Save program to a specific filename (e.g. "program_1.txt")
bool storage_save_file(const char* filename, const char* code);

// Load program from a specific filename
bool storage_load_file(const char* filename, char* out_code, size_t max_len);

// Get list of all available .txt files in storage directory
int storage_list_files(char file_list[MAX_SAVED_FILES][MAX_FILENAME_LEN]);

// Get next available slot filename e.g. "program_1.txt", "program_2.txt"
void storage_get_next_slot_name(char* out_name, size_t max_len);

#endif // SHIFT_STORAGE_H
